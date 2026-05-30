# Nomono Staff App — V2 Majoo Integration Handoff

## Overview

Staff app untuk Nomono Padel Club. V2 menambahkan fitur import transaksi harian dari Majoo POS untuk otomatis distribusi EXP & Koin ke member.

**Repo:** `papypoko89/nomono-staff`
**Branch aktif:** `feature/majoo-integration` (belum di-merge ke `main`)
**Live (v1):** `nomono-staff.vercel.app`
**Supabase Project ID:** `sysamlqxpdzgoanccjjt`

---

## Tech Stack

- Vite + React 19 + TypeScript
- Tailwind CSS 3.4
- Supabase (`@supabase/supabase-js` 2.103)
- Font: DM Mono
- Package manager: pnpm

**Auth:** Bukan Supabase Auth. Login via query tabel `staff` by email, password hardcoded `nomono2025`. `auth.uid()` selalu null.

---

## Struktur File V2 (yang ditambahkan)

```
src/
  lib/
    majoo-helpers.ts      — normalizePhone(), isValidIndonesianMobile()
    majoo-parser.ts       — parseMajooExcel(), decideMajooRow()
  pages/
    MajooHub.tsx          — landing page tab Majoo
    MajooImport.tsx       — upload & proses file xlsx
    UnmatchedReview.tsx   — assign/skip transaksi unmatched
    ImportHistory.tsx     — riwayat semua import
supabase/
  migrations/
    20260518000000_majoo_integration.sql
docs/
  MAJOO_INTEGRATION.md    — SOP untuk admin/kasir
  V2_MAJOO_HANDOFF.md     — dokumen ini
```

**File yang dimodifikasi:**
- `src/lib/types.ts` — tambah types: `MajooImport`, `UnmatchedTransaction`, perms `import_majoo` / `review_unmatched`
- `src/lib/db.ts` — tambah hooks: `findMemberByPhone`, `createMajooImport`, `updateMajooImport`, `addUnmatchedTx`, `resolveUnmatchedTx`, `skipUnmatchedTx`
- `src/pages/Dashboard.tsx` — tambah unmatched alert banner + Majoo sync status card
- `src/pages/Scan.tsx` — disederhanakan, hapus preset flow, check-in only (+25 EXP)
- `src/App.tsx` — tambah routes majoo, majoo-import, majoo-review, majoo-history + bottom nav badge

---

## Alur Kerja Fitur

1. Admin upload file `.xlsx` Detail Penjualan dari Majoo
2. Parser baca file → deteksi header row → map kolom
3. Tiap baris diputuskan: **match** / **skip** / **unmatched**
4. Match → insert ke `transactions` + update `members.total_exp` & `coin_balance`
5. Unmatched → masuk `unmatched_transactions` untuk review manual
6. Admin bisa assign unmatched ke member atau skip

**Formula poin:** `floor(nominal / 10.000) × 100 EXP` dan `× 10 Koin`

---

## Format File Majoo

File `.xlsx` Detail Penjualan dari Majoo:
- Baris 0–11: header block (info toko, tanggal, dll)
- Baris 12: header kolom (`No Transaksi`, `Pelanggan`, `No Telepon Pelanggan`, dll)
- Baris 13+: data transaksi
- Baris terakhir: footer "Powered By Majoo"

**Kolom yang dipakai:**
| Kolom Majoo | Field |
|---|---|
| No Transaksi | `no_transaksi` — kode unik untuk cegah duplikat |
| No Telepon Pelanggan | `no_telepon` — dihubungkan ke member via `phone_normalized` |
| Pelanggan | `pelanggan` — nama pelanggan di Majoo |
| Total Penjualan (Rp) | `total_penjualan` — dasar kalkulasi poin |
| Status Pembayaran | `status_pembayaran` — skip jika "Belum Lunas" |
| Jumlah Refund (Rp) | `jumlah_refund` — skip jika > 0 |

**Phone normalization:** strip non-digit → strip prefix `62`/`+62`/`0` → hasil `8xxxxxxxxx`
Contoh: `08123456789` → `8123456789`

---

## Database

### Tabel Baru
- `majoo_imports` — log setiap kali file di-upload
- `unmatched_transactions` — transaksi yang tidak bisa di-match otomatis

### Kolom Baru di Tabel Lama
- `members.phone_normalized` — nomor HP yang sudah dinormalisasi, dipakai untuk matching
- `members.majoo_synced_at` — timestamp sync terakhir
- `transactions.source` — enum: `staff_scan | admin_manual | system | majoo`
- `transactions.majoo_import_id` — FK ke `majoo_imports`
- `transactions.majoo_transaction_id` — No Transaksi dari Majoo (untuk cegah duplikat)
- `transactions.nominal_amount` — nominal transaksi asli dari Majoo

### RLS — Penting!
App tidak pakai Supabase Auth → `auth.uid()` selalu null. Tabel `transactions` punya RLS aktif dengan policy INSERT yang require `auth.uid()` → sudah difix dengan menambah policy `anon_insert_transactions`.

Tabel `majoo_imports` dan `unmatched_transactions` tidak pakai RLS (dinonaktifkan).

---

## Bugs yang Sudah Difix

| Bug | Root Cause | Fix |
|---|---|---|
| Phone tidak match | `.single()` error saat ada duplikat nomor HP di DB | Ganti ke `.limit(1)` |
| Phone tidak match | `.eq('is_active', true)` — kolom tidak ada di DB | Hapus filter |
| Transaksi tidak tersimpan | Enum `majoo` belum ada di `transaction_source` | `ALTER TYPE transaction_source ADD VALUE 'majoo'` |
| Transaksi tidak tersimpan | Kolom `category`, `amount_rp`, `exp_earned`, `coins_earned` NOT NULL tanpa default | Tambah `DEFAULT` values |
| Transaksi tidak tersimpan | Insert pakai `created_by` tapi kolom DB = `staff_id` | Ganti ke `staff_id: null` |
| Transaksi tidak tersimpan | RLS policy INSERT di `transactions` require `auth.uid()` | Tambah `anon_insert_transactions` policy |

---

## Kondisi Database Saat Ini

- Semua member balance sudah di-reset (direset ulang setelah bug insert ditemukan)
- Data `majoo_imports` dan `unmatched_transactions` kosong (clean slate)
- Migration sudah applied ke production Supabase
- Siap untuk tes upload pertama yang benar

---

## Permission Roles

| Role | import_majoo | review_unmatched |
|---|---|---|
| Manager | ✅ | ✅ |
| Front Desk | ❌ | ❌ |
| F&B | ❌ | ❌ |
| Merchant | ❌ | ❌ |

---

## Yang Belum Selesai / Perlu Diverifikasi

1. **Tes end-to-end duplikat** — upload file yang sama 2x, pastikan upload ke-2 semua masuk "Duplikat"
2. **`updateMemberBalance`** — perlu dicek apakah kolom di DB adalah `coin_balance` atau `koin_balance` (ada inkonsistensi lama di codebase, hint di CLAUDE.md baris gotcha #3)
3. **Unmatched review flow** — belum ditest apakah assign dari review page juga menyimpan transaksi dengan benar (kemungkinan kena bug yang sama)
4. **Branch belum di-merge** ke `main` dan belum di-deploy ke Vercel

---

## Cara Jalankan Lokal

```bash
cd nomono-staff-source/nomono-staff-app
pnpm install
# buat .env dengan:
# VITE_SUPABASE_URL=https://sysamlqxpdzgoanccjjt.supabase.co
# VITE_SUPABASE_ANON_KEY=<anon key>
pnpm dev
```

Login: `admin@nomono.id` / `nomono2025`
