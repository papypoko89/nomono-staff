-- ============================================
-- MIGRATION: Majoo Integration v2.3
-- Semua perubahan ADDITIVE (tidak ada DROP atau destructive ops)
-- ⚠️  JANGAN apply ke production tanpa konfirmasi Nix terlebih dahulu
-- ============================================

-- ────────────────────────────────────────────
-- 1. Extend tabel `members`
-- ────────────────────────────────────────────
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT,
  ADD COLUMN IF NOT EXISTS majoo_synced_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_members_phone            ON members(phone);
CREATE INDEX IF NOT EXISTS idx_members_phone_normalized ON members(phone_normalized);

-- Fungsi normalisasi nomor HP Indonesia
-- Contoh: "085842667006" → "85842667006"
--         "+6285842667006" → "85842667006"
--         "628584" → "8584"
CREATE OR REPLACE FUNCTION normalize_phone_text(phone TEXT)
RETURNS TEXT AS $$
BEGIN
  IF phone IS NULL OR phone = '' THEN RETURN ''; END IF;
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(phone, '[^0-9]', '', 'g'),  -- hapus non-digit
      '^62', ''                                   -- hapus kode negara 62
    ),
    '^0', ''                                      -- hapus leading zero
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger: auto-normalize phone saat insert/update
CREATE OR REPLACE FUNCTION set_member_phone_normalized()
RETURNS TRIGGER AS $$
BEGIN
  NEW.phone_normalized := normalize_phone_text(NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_member_phone_normalized ON members;
CREATE TRIGGER trg_member_phone_normalized
  BEFORE INSERT OR UPDATE OF phone ON members
  FOR EACH ROW
  EXECUTE FUNCTION set_member_phone_normalized();

-- Backfill semua member yang sudah ada
UPDATE members
SET phone_normalized = normalize_phone_text(phone)
WHERE phone_normalized IS NULL AND phone IS NOT NULL;


-- ────────────────────────────────────────────
-- 2. Extend tabel `transactions`
-- ────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source               TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS majoo_import_id      UUID,
  ADD COLUMN IF NOT EXISTS majoo_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS nominal_amount       NUMERIC(15,2);

CREATE INDEX IF NOT EXISTS idx_tx_source       ON transactions(source);
CREATE INDEX IF NOT EXISTS idx_tx_majoo_import ON transactions(majoo_import_id);

-- Cegah transaksi Majoo yang sama di-import dua kali
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_majoo_unique
  ON transactions(majoo_transaction_id)
  WHERE majoo_transaction_id IS NOT NULL;


-- ────────────────────────────────────────────
-- 3. Tabel baru: `majoo_imports`
--    Log setiap kali admin upload file Majoo
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS majoo_imports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at      TIMESTAMPTZ DEFAULT now(),
  imported_by      UUID,                        -- staff.id, tanpa FK (per learnings: FK ke staff bisa silent fail)
  imported_by_name TEXT,
  file_name        TEXT,
  periode_start    TIMESTAMPTZ,
  periode_end      TIMESTAMPTZ,
  total_rows       INT         DEFAULT 0,
  matched_count    INT         DEFAULT 0,
  unmatched_count  INT         DEFAULT 0,
  skipped_count    INT         DEFAULT 0,
  total_exp_added  INT         DEFAULT 0,
  total_koin_added INT         DEFAULT 0,
  total_nominal    NUMERIC(15,2) DEFAULT 0,
  status           TEXT        DEFAULT 'pending', -- 'pending'|'completed'|'failed'|'rolled_back'
  notes            TEXT,
  skip_reasons     JSONB,       -- {"not_paid": 2, "zero_amount": 1, ...}
  raw_data         JSONB        -- baris original untuk keperluan rollback
);

CREATE INDEX IF NOT EXISTS idx_majoo_imports_status ON majoo_imports(status);
CREATE INDEX IF NOT EXISTS idx_majoo_imports_date   ON majoo_imports(imported_at DESC);

-- Disable RLS (per learnings: RLS bisa bikin silent 500 error selama dev)
ALTER TABLE majoo_imports DISABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────
-- 4. Tabel baru: `unmatched_transactions`
--    Transaksi dari Majoo yang tidak bisa di-match ke member
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS unmatched_transactions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id               UUID,                   -- majoo_imports.id, tanpa FK (per learnings)
  majoo_transaction_id    TEXT,
  majoo_phone             TEXT,
  majoo_phone_normalized  TEXT,
  majoo_customer_name     TEXT,
  transaction_date        TIMESTAMPTZ,
  total_nominal           NUMERIC(15,2),
  reason                  TEXT,        -- 'no_phone'|'invalid_phone'|'phone_not_found'
  status                  TEXT        DEFAULT 'pending', -- 'pending'|'assigned'|'skipped'
  assigned_member_id      UUID,
  resolved_at             TIMESTAMPTZ,
  resolved_by             UUID,        -- staff.id, tanpa FK
  resolved_by_name        TEXT,
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unmatched_status ON unmatched_transactions(status);
CREATE INDEX IF NOT EXISTS idx_unmatched_import ON unmatched_transactions(import_id);

-- Disable RLS
ALTER TABLE unmatched_transactions DISABLE ROW LEVEL SECURITY;
