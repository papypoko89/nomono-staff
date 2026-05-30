# CODE_REVIEW_BUNDLE — Nomono Staff App V2 Majoo Integration

---

## src/lib/majoo-helpers.ts

```typescript
/**
 * Normalisasi nomor HP Indonesia ke format tanpa kode negara dan tanpa leading zero.
 * Contoh:
 *   "085842667006"   → "85842667006"
 *   "+6285842667006" → "85842667006"
 *   "6285842667006"  → "85842667006"
 *   "08123-456-789"  → "8123456789"
 */
export function normalizePhone(input: string): string {
  if (!input) return '';
  const digits = input.replace(/[^0-9]/g, ''); // hapus semua non-digit
  if (!digits) return '';

  // Hapus kode negara 62
  if (digits.startsWith('62')) return digits.slice(2);
  // Hapus leading zero
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}

/**
 * Validasi apakah nomor (sudah normalized) adalah HP Indonesia yang valid.
 * HP Indonesia setelah normalisasi: 8-12 digit, dimulai dengan 8.
 * Contoh valid: "85842667006" (11 digit, mulai 8)
 */
export function isValidIndonesianMobile(normalized: string): boolean {
  if (!normalized) return false;
  return /^8[0-9]{7,11}$/.test(normalized);
}
```

---

## src/lib/majoo-parser.ts

```typescript
import * as XLSX from 'xlsx';
import { normalizePhone, isValidIndonesianMobile } from './majoo-helpers';
import type { Member } from './types';

// ── Types ──

export interface MajooRow {
  rowNumber: number;
  no_transaksi: string;
  waktu_order: Date | null;
  waktu_bayar: Date | null;
  pelanggan: string;
  no_telepon: string;
  jenis_order: string;
  total_penjualan: number;
  status_pesanan: string;
  metode_pembayaran: string;
  status_pembayaran: string;
  tanggal_refund: Date | null;
  jumlah_refund: number;
}

export interface ParseMeta {
  outlet: string;
  total_penjualan: number;
  total_transaksi: number;
  periode_start: Date | null;
  periode_end: Date | null;
  date_generated: Date | null;
}

export interface ParseResult {
  meta: ParseMeta;
  rows: MajooRow[];
}

// Hasil keputusan per baris saat proses import
export type SkipReason = 'not_paid' | 'zero_or_negative_amount' | 'refunded' | 'voided' | 'duplicate';
export type UnmatchedReason = 'no_phone' | 'invalid_phone' | 'phone_not_found';

export interface MatchDecision {
  action: 'match' | 'skip' | 'unmatched';
  skipReason?: SkipReason;
  unmatchedReason?: UnmatchedReason;
  member?: Member;
  exp?: number;
  koin?: number;
  normalizedPhone?: string;
}

// ── Kolom yang wajib ada ──
const EXPECTED_HEADERS = [
  'No Transaksi',
  'Waktu Order',
  'Waktu Bayar',
  'Pelanggan',
  'No Telepon Pelanggan',
  'Jenis Order',
  'Total Penjualan (Rp)',
  'Status Pesanan',
  'Metode Pembayaran',
  'Status Pembayaran',
  'Tanggal Refund',
  'Jumlah Refund (Rp)',
];

// ── Parser utama ──

export async function parseMajooExcel(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    blankrows: false,
  });

  // Cari baris header (kolom pertama = "No Transaksi")
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(20, data.length); i++) {
    if (String(data[i][0] || '').trim() === 'No Transaksi') {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      'File tidak dikenali sebagai Detail Penjualan Majoo. ' +
      'Pastikan template "Nomono Sync" aktif saat ekspor.'
    );
  }

  // Ekstrak metadata dari blok header (baris 0 s/d sebelum header kolom)
  const meta = extractMetadata(data.slice(0, headerRowIndex));

  // Map nama kolom → index
  const headers = data[headerRowIndex].map((h: any) => String(h || '').trim());
  const colMap: Record<string, number> = {};
  for (const expected of EXPECTED_HEADERS) {
    const idx = headers.indexOf(expected);
    if (idx === -1) {
      throw new Error(
        `Kolom "${expected}" tidak ditemukan. ` +
        'Pastikan template "Nomono Sync" yang dipakai untuk ekspor.'
      );
    }
    colMap[expected] = idx;
  }

  // Parse baris data
  const rows: MajooRow[] = [];
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // Stop di footer "Powered By"
    const lastCell = String(row[row.length - 1] || '').trim().toLowerCase();
    if (lastCell.includes('powered by')) break;

    const noTransaksi = String(row[colMap['No Transaksi']] || '').trim();
    if (!noTransaksi) continue;

    rows.push({
      rowNumber: i + 1,
      no_transaksi: noTransaksi,
      waktu_order: parseMajooDate(row[colMap['Waktu Order']]),
      waktu_bayar: parseMajooDate(row[colMap['Waktu Bayar']]),
      pelanggan: cleanText(row[colMap['Pelanggan']]),
      no_telepon: cleanText(row[colMap['No Telepon Pelanggan']]),
      jenis_order: cleanText(row[colMap['Jenis Order']]),
      total_penjualan: parseMajooNumber(row[colMap['Total Penjualan (Rp)']]),
      status_pesanan: cleanText(row[colMap['Status Pesanan']]),
      metode_pembayaran: cleanText(row[colMap['Metode Pembayaran']]),
      status_pembayaran: cleanText(row[colMap['Status Pembayaran']]),
      tanggal_refund: parseMajooDate(row[colMap['Tanggal Refund']]),
      jumlah_refund: parseMajooNumber(row[colMap['Jumlah Refund (Rp)']]),
    });
  }

  return { meta, rows };
}

// ── Match logic ──

/**
 * Tentukan aksi untuk satu baris Majoo:
 * - skip     : tidak masuk ke DB sama sekali
 * - unmatched: masuk ke antrian review
 * - match    : langsung berikan EXP + Koin ke member
 *
 * findMember: callback async yang mencari member by normalized phone
 */
export async function decideMajooRow(
  row: MajooRow,
  existingTransactionIds: Set<string>,
  findMember: (normalizedPhone: string) => Promise<Member | null>,
): Promise<MatchDecision> {

  // 1. Skip: total <= 0
  if (row.total_penjualan <= 0) {
    return { action: 'skip', skipReason: 'zero_or_negative_amount' };
  }

  // 2. Skip: belum lunas
  if (row.status_pembayaran !== 'Lunas') {
    return { action: 'skip', skipReason: 'not_paid' };
  }

  // 3. Skip: ada refund
  if (row.tanggal_refund || row.jumlah_refund > 0) {
    return { action: 'skip', skipReason: 'refunded' };
  }

  // 4. Skip: batal / void
  const statusLower = row.status_pesanan.toLowerCase();
  if (statusLower.includes('batal') || statusLower.includes('void')) {
    return { action: 'skip', skipReason: 'voided' };
  }

  // 5. Skip: duplikat (sudah pernah di-import)
  if (existingTransactionIds.has(row.no_transaksi)) {
    return { action: 'skip', skipReason: 'duplicate' };
  }

  // 6. Unmatched: tidak ada nomor HP
  if (!row.no_telepon) {
    return { action: 'unmatched', unmatchedReason: 'no_phone' };
  }

  // 7. Unmatched: format HP tidak valid
  const normalized = normalizePhone(row.no_telepon);
  if (!isValidIndonesianMobile(normalized)) {
    return { action: 'unmatched', unmatchedReason: 'invalid_phone', normalizedPhone: normalized };
  }

  // 8. Cari member di DB
  const member = await findMember(normalized);
  if (!member) {
    return { action: 'unmatched', unmatchedReason: 'phone_not_found', normalizedPhone: normalized };
  }

  // 9. Match — hitung EXP & Koin
  // Rumus: floor(total / 10.000) × 100 EXP + floor(total / 10.000) × 10 Koin
  const multiplier = Math.floor(row.total_penjualan / 10000);
  const exp = multiplier * 100;
  const koin = multiplier * 10;

  return { action: 'match', member, exp, koin, normalizedPhone: normalized };
}

// ── Helpers internal ──

/**
 * Parse format tanggal Majoo: "DD-MM-YYYY HH:MM:SS"
 * Mengembalikan null jika kosong atau tidak valid.
 */
function parseMajooDate(value: any): Date | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str === '-') return null;

  const match = str.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, dd, mm, yyyy, hh, mi, ss] = match;
  return new Date(+yyyy, +mm - 1, +dd, +hh, +mi, +ss);
}

/**
 * Parse angka dari Majoo (pure integer, kadang bisa string).
 * Mengembalikan 0 jika kosong.
 */
function parseMajooNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const str = String(value).replace(/[^\d-]/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Bersihkan teks: kembalikan string kosong jika nilai adalah "-" atau null.
 */
function cleanText(value: any): string {
  if (!value) return '';
  const str = String(value).trim();
  return str === '-' ? '' : str;
}

/**
 * Ekstrak metadata dari blok header Majoo (baris 0 s/d sebelum header kolom).
 */
function extractMetadata(headerBlock: any[][]): ParseMeta {
  const meta: ParseMeta = {
    outlet: '',
    total_penjualan: 0,
    total_transaksi: 0,
    periode_start: null,
    periode_end: null,
    date_generated: null,
  };

  for (const row of headerBlock) {
    const firstCell = String(row[0] || '').trim();

    // Outlet: kolom terakhir baris pertama
    if (!meta.outlet) {
      const lastCell = String(row[row.length - 1] || '').trim();
      if (lastCell && lastCell !== 'Semua Outlet' && !lastCell.includes('Date')) {
        meta.outlet = lastCell;
      }
    }

    // Periode: "01 Mei 2026 00:00:00 - 31 Mei 2026 23:59:59"
    if (firstCell === 'Periode') {
      const periodeStr = String(row[1] || '');
      const parts = periodeStr.split(' - ');
      if (parts.length === 2) {
        meta.periode_start = parseIndonesianDate(parts[0]);
        meta.periode_end = parseIndonesianDate(parts[1]);
      }
    }

    // Total Penjualan & Total Transaksi (bisa di kolom mana saja)
    for (let i = 0; i < row.length - 1; i++) {
      const cell = String(row[i] || '').trim();
      if (cell === 'Total Penjualan') meta.total_penjualan = parseMajooNumber(row[i + 1]);
      if (cell === 'Total Transaksi') meta.total_transaksi = parseMajooNumber(row[i + 1]);
    }

    // Date Generated
    const rowStr = row.map((c: any) => String(c || '')).join('|');
    if (rowStr.includes('Date Generated')) {
      const match = rowStr.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}:\d{2}:\d{2})/);
      if (match) {
        const [d, m, y] = match[1].split('/');
        const [hh, mi, ss] = match[2].split(':');
        meta.date_generated = new Date(+y, +m - 1, +d, +hh, +mi, +ss);
      }
    }
  }

  return meta;
}

/**
 * Parse format tanggal Indonesia: "09 Mei 2026 00:00:00"
 */
const ID_MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function parseIndonesianDate(str: string): Date | null {
  const match = str.trim().match(/(\d{1,2})\s+(\w+)\s+(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, dd, monthName, yyyy, hh = '0', mi = '0', ss = '0'] = match;
  const monthIdx = ID_MONTHS.findIndex(m =>
    monthName.toLowerCase().startsWith(m.toLowerCase())
  );
  if (monthIdx === -1) return null;
  return new Date(+yyyy, monthIdx, +dd, +hh, +mi, +ss);
}
```

---

## src/pages/MajooImport.tsx

```tsx
import React, { useState, useRef } from 'react';
import { IC } from '../components/ui';
import { parseMajooExcel, decideMajooRow, type MajooRow, type MatchDecision } from '../lib/majoo-parser';
import type { Staff, Member } from '../lib/types';
import type { MajooImport } from '../lib/types';

// ── Types lokal ──

interface ProcessedRow {
  row: MajooRow;
  decision: MatchDecision;
}

interface ImportSummary {
  matched: ProcessedRow[];
  unmatched: ProcessedRow[];
  skipped: ProcessedRow[];
  totalExp: number;
  totalKoin: number;
  totalNominal: number;
}

type Step = 'upload' | 'preview' | 'processing' | 'done' | 'error';

// ── Props ──

interface Props {
  staff: Staff;
  onBack: () => void;
  findMemberByPhone: (phone: string) => Promise<Member | null>;
  createMajooImport: (payload: Omit<MajooImport, 'id' | 'imported_at'>) => Promise<MajooImport | null>;
  updateMajooImport: (id: string, updates: Partial<MajooImport>) => Promise<boolean>;
  addUnmatchedTx: (payload: any) => Promise<boolean>;
  addTransaction: (tx: any) => Promise<boolean>;
  updateMemberBalance: (memberId: string, addExp: number, addKoin: number) => Promise<boolean>;
  existingMajooTxIds: Set<string>;
}

// ── Label helper ──

const SKIP_LABELS: Record<string, string> = {
  not_paid: 'Belum Lunas',
  zero_or_negative_amount: 'Total Rp 0',
  refunded: 'Refund',
  voided: 'Batal/Void',
  duplicate: 'Duplikat',
};

const UNMATCHED_LABELS: Record<string, string> = {
  no_phone: 'Tanpa HP',
  invalid_phone: 'HP Tidak Valid',
  phone_not_found: 'HP Tidak Terdaftar',
};

export default function MajooImportPage({
  staff,
  onBack,
  findMemberByPhone,
  createMajooImport,
  updateMajooImport,
  addUnmatchedTx,
  addTransaction,
  updateMemberBalance,
  existingMajooTxIds,
}: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<MajooRow[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [processing, setProcessing] = useState(false);
  const [doneImport, setDoneImport] = useState<MajooImport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDrag, setIsDrag] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Langkah 1: parse file ──
  const handleFile = async (f: File) => {
    setFile(f);
    setParseError(null);
    try {
      const result = await parseMajooExcel(f);
      setMeta(result.meta);
      setRows(result.rows);

      // Preview: hitung estimasi match/unmatched/skip (tanpa hit DB)
      const decisions = await Promise.all(
        result.rows.map(row => decideMajooRow(row, existingMajooTxIds, findMemberByPhone))
      );

      const processed: ProcessedRow[] = result.rows.map((row, i) => ({ row, decision: decisions[i] }));
      setSummary(buildSummary(processed));
      setStep('preview');
    } catch (e: any) {
      setParseError(e.message || 'Gagal membaca file');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Langkah 2: konfirmasi → proses ──
  const doImport = async () => {
    if (!file || !summary) return;
    setProcessing(true);
    setStep('processing');

    try {
      // Buat record import dulu (status pending)
      const importRecord = await createMajooImport({
        imported_by: staff.id,
        imported_by_name: staff.full_name,
        file_name: file.name,
        periode_start: meta?.periode_start?.toISOString() ?? null,
        periode_end: meta?.periode_end?.toISOString() ?? null,
        total_rows: rows.length,
        matched_count: 0,
        unmatched_count: 0,
        skipped_count: 0,
        total_exp_added: 0,
        total_koin_added: 0,
        total_nominal: 0,
        status: 'pending',
        notes: null,
        skip_reasons: null,
      });

      if (!importRecord) throw new Error('Gagal membuat import record');

      const importId = importRecord.id;
      let matchedCount = 0;
      let unmatchedCount = 0;
      let skippedCount = 0;
      let totalExp = 0;
      let totalKoin = 0;
      let totalNominal = 0;
      const skipReasons: Record<string, number> = {};

      // Re-compute decisions (pakai existingIds yang fresh)
      const decisions = await Promise.all(
        rows.map(row => decideMajooRow(row, existingMajooTxIds, findMemberByPhone))
      );

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const d = decisions[i];

        if (d.action === 'skip') {
          skippedCount++;
          const r = d.skipReason || 'unknown';
          skipReasons[r] = (skipReasons[r] || 0) + 1;

        } else if (d.action === 'unmatched') {
          unmatchedCount++;
          await addUnmatchedTx({
            import_id: importId,
            majoo_transaction_id: row.no_transaksi,
            majoo_phone: row.no_telepon || null,
            majoo_phone_normalized: d.normalizedPhone || null,
            majoo_customer_name: row.pelanggan || null,
            transaction_date: row.waktu_bayar?.toISOString() ?? row.waktu_order?.toISOString() ?? null,
            total_nominal: row.total_penjualan,
            reason: d.unmatchedReason || null,
            status: 'pending',
            assigned_member_id: null,
            resolved_at: null,
            resolved_by: null,
            resolved_by_name: null,
            notes: null,
          });

        } else if (d.action === 'match' && d.member) {
          matchedCount++;
          totalExp += d.exp ?? 0;
          totalKoin += d.koin ?? 0;
          totalNominal += row.total_penjualan;

          await addTransaction({
            member_id: d.member.id,
            exp_amount: d.exp ?? 0,
            koin_amount: d.koin ?? 0,
            description: `Import Majoo — ${row.no_transaksi}`,
            preset_id: null,
            created_by: staff.id,
            staff_name: staff.full_name,
            source: 'majoo',
            majoo_import_id: importId,
            majoo_transaction_id: row.no_transaksi,
            nominal_amount: row.total_penjualan,
          });

          await updateMemberBalance(d.member.id, d.exp ?? 0, d.koin ?? 0);
        }
      }

      // Update record import dengan hasil final
      await updateMajooImport(importId, {
        matched_count: matchedCount,
        unmatched_count: unmatchedCount,
        skipped_count: skippedCount,
        total_exp_added: totalExp,
        total_koin_added: totalKoin,
        total_nominal: totalNominal,
        status: 'completed',
        skip_reasons: Object.keys(skipReasons).length ? skipReasons : null,
      });

      setDoneImport({ ...importRecord, matched_count: matchedCount, unmatched_count: unmatchedCount, skipped_count: skippedCount, total_exp_added: totalExp, total_koin_added: totalKoin, total_nominal: totalNominal, status: 'completed' });
      setStep('done');

    } catch (e: any) {
      setErrorMsg(e.message || 'Terjadi error saat proses import');
      setStep('error');
    } finally {
      setProcessing(false);
    }
  };

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} style={{ color: '#231F2088' }}>{IC.back}</button>
        <h1 className="font-mono text-sm font-bold" style={{ color: '#231F20' }}>Import Majoo</h1>
        <div className="w-5" />
      </div>

      {/* ── Step: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: '#231F2066' }}>
            Upload file Detail Penjualan dari Majoo
          </p>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setIsDrag(true); }}
            onDragLeave={() => setIsDrag(false)}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors"
            style={{ borderColor: isDrag ? '#C39A4B' : '#231F2020', background: isDrag ? '#C39A4B08' : 'transparent' }}
          >
            <div style={{ color: isDrag ? '#C39A4B' : '#231F2044' }}>{IC.upload}</div>
            <div className="text-center">
              <div className="font-mono text-xs font-medium" style={{ color: '#231F20' }}>
                Drag & drop atau tap untuk pilih file
              </div>
              <div className="font-mono text-[10px] mt-1" style={{ color: '#231F2066' }}>
                Format: .xlsx (Detail Penjualan Majoo)
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          {parseError && (
            <div className="p-3 rounded-lg border font-mono text-xs" style={{ background: '#dc262608', borderColor: '#dc262620', color: '#dc2626' }}>
              {IC.alert} {parseError}
            </div>
          )}

          {/* Panduan */}
          <div className="p-4 rounded-lg border space-y-2" style={{ borderColor: '#231F2010' }}>
            <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#231F2066' }}>Cara Export dari Majoo</div>
            {['Buka Majoo → Laporan → Detail Penjualan', 'Pilih periode (hari ini)', 'Pastikan template "Nomono Sync" aktif', 'Klik Export → Download .xlsx'].map((s, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="font-mono text-[9px] mt-0.5 shrink-0" style={{ color: '#C39A4B' }}>{i + 1}.</span>
                <span className="font-mono text-[10px]" style={{ color: '#231F20' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step: Preview ── */}
      {step === 'preview' && summary && file && (
        <div className="space-y-4">
          {/* Info file */}
          <div className="p-3 rounded-lg border flex items-center gap-3" style={{ borderColor: '#231F2015' }}>
            <div style={{ color: '#003820' }}>{IC.fileSpreadsheet}</div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs font-medium truncate" style={{ color: '#231F20' }}>{file.name}</div>
              {meta?.periode_start && (
                <div className="font-mono text-[10px]" style={{ color: '#231F2066' }}>
                  {meta.periode_start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {meta.periode_end && meta.periode_end.toDateString() !== meta.periode_start.toDateString() &&
                    ` — ${meta.periode_end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  }
                </div>
              )}
            </div>
            <div className="font-mono text-[10px] shrink-0" style={{ color: '#231F2066' }}>{rows.length} baris</div>
          </div>

          {/* Ringkasan */}
          <div className="p-4 rounded-lg border space-y-3" style={{ borderColor: '#231F2010' }}>
            <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#231F2066' }}>Ringkasan Hasil</div>

            <div className="space-y-2">
              {/* Matched */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">✅</span>
                  <span className="font-mono text-xs" style={{ color: '#231F20' }}>Matched</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm font-bold" style={{ color: '#003820' }}>{summary.matched.length}</span>
                  {summary.matched.length > 0 && (
                    <span className="font-mono text-[10px] ml-2" style={{ color: '#231F2066' }}>
                      +{summary.totalExp} EXP · +{summary.totalKoin} Koin
                    </span>
                  )}
                </div>
              </div>

              {/* Unmatched */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">⚠️</span>
                  <span className="font-mono text-xs" style={{ color: '#231F20' }}>Unmatched</span>
                </div>
                <span className="font-mono text-sm font-bold" style={{ color: '#C39A4B' }}>{summary.unmatched.length}</span>
              </div>

              {/* Skipped */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">⏭</span>
                  <span className="font-mono text-xs" style={{ color: '#231F20' }}>Dilewati</span>
                </div>
                <span className="font-mono text-sm font-bold" style={{ color: '#231F2066' }}>{summary.skipped.length}</span>
              </div>
            </div>

            {/* Detail skip */}
            {summary.skipped.length > 0 && (
              <div className="pt-2 border-t space-y-1" style={{ borderColor: '#231F2010' }}>
                {Object.entries(
                  summary.skipped.reduce((acc, p) => {
                    const k = p.decision.skipReason || 'unknown';
                    acc[k] = (acc[k] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between">
                    <span className="font-mono text-[10px]" style={{ color: '#231F2066' }}>
                      — {SKIP_LABELS[reason] || reason}
                    </span>
                    <span className="font-mono text-[10px]" style={{ color: '#231F2066' }}>{count}x</span>
                  </div>
                ))}
              </div>
            )}

            {/* Detail unmatched */}
            {summary.unmatched.length > 0 && (
              <div className="pt-2 border-t space-y-1" style={{ borderColor: '#231F2010' }}>
                {Object.entries(
                  summary.unmatched.reduce((acc, p) => {
                    const k = p.decision.unmatchedReason || 'unknown';
                    acc[k] = (acc[k] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between">
                    <span className="font-mono text-[10px]" style={{ color: '#C39A4B' }}>
                      ⚠ {UNMATCHED_LABELS[reason] || reason}
                    </span>
                    <span className="font-mono text-[10px]" style={{ color: '#C39A4B' }}>{count}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detail matched */}
          {summary.matched.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#231F2066' }}>
                Transaksi yang akan diproses
              </div>
              {summary.matched.map(({ row, decision }) => (
                <div key={row.no_transaksi} className="flex items-center justify-between p-2.5 rounded-lg border" style={{ borderColor: '#231F2010' }}>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-medium truncate" style={{ color: '#231F20' }}>
                      {decision.member?.full_name}
                    </div>
                    <div className="font-mono text-[10px]" style={{ color: '#231F2066' }}>
                      {row.no_transaksi} · Rp {row.total_penjualan.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div className="font-mono text-[10px] font-bold text-green-600">+{decision.exp} EXP</div>
                    <div className="font-mono text-[10px]" style={{ color: '#C39A4B' }}>+{decision.koin} Koin</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {summary.matched.length === 0 && summary.unmatched.length === 0 && (
            <div className="p-4 rounded-lg text-center font-mono text-xs" style={{ background: '#231F2008', color: '#231F2066' }}>
              Tidak ada transaksi yang bisa diproses dari file ini.
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setStep('upload'); setFile(null); setSummary(null); }}
              className="flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest border"
              style={{ borderColor: '#231F2015', color: '#231F2088' }}
            >
              Ganti File
            </button>
            <button
              onClick={doImport}
              disabled={processing || (summary.matched.length === 0 && summary.unmatched.length === 0)}
              className="flex-1 py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold text-white disabled:opacity-40"
              style={{ background: '#003820' }}
            >
              Proses Import
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Processing ── */}
      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-10 h-10 border-2 border-[#C39A4B] border-t-transparent rounded-full animate-spin" />
          <div className="font-mono text-xs uppercase tracking-widest" style={{ color: '#231F2088' }}>
            Memproses transaksi...
          </div>
        </div>
      )}

      {/* ── Step: Done ── */}
      {step === 'done' && doneImport && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border-2 text-center" style={{ borderColor: '#003820', background: '#00382008' }}>
            <div className="font-mono text-base font-bold mb-1" style={{ color: '#003820' }}>✓ Import Berhasil</div>
            <div className="font-mono text-[10px]" style={{ color: '#231F2066' }}>{file?.name}</div>
          </div>

          <div className="p-4 rounded-lg border space-y-3" style={{ borderColor: '#231F2010' }}>
            <div className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: '#231F2066' }}>Hasil</div>

            <div className="flex justify-between items-center">
              <span className="font-mono text-xs" style={{ color: '#231F20' }}>✅ Matched</span>
              <div className="text-right">
                <span className="font-mono text-sm font-bold" style={{ color: '#003820' }}>{doneImport.matched_count}</span>
                {doneImport.matched_count > 0 && (
                  <span className="font-mono text-[10px] ml-2" style={{ color: '#231F2066' }}>
                    +{doneImport.total_exp_added} EXP · +{doneImport.total_koin_added} Koin
                  </span>
                )}
              </div>
            </div>

            {doneImport.unmatched_count > 0 && (
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs" style={{ color: '#C39A4B' }}>⚠️ Unmatched (perlu review)</span>
                <span className="font-mono text-sm font-bold" style={{ color: '#C39A4B' }}>{doneImport.unmatched_count}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="font-mono text-xs" style={{ color: '#231F2066' }}>⏭ Dilewati</span>
              <span className="font-mono text-sm font-bold" style={{ color: '#231F2066' }}>{doneImport.skipped_count}</span>
            </div>
          </div>

          <button
            onClick={onBack}
            className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest font-bold text-white"
            style={{ background: '#003820' }}
          >
            Selesai
          </button>
        </div>
      )}

      {/* ── Step: Error ── */}
      {step === 'error' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg border text-center" style={{ background: '#dc262608', borderColor: '#dc262620' }}>
            <div className="font-mono text-xs font-bold mb-1" style={{ color: '#dc2626' }}>Import Gagal</div>
            <div className="font-mono text-[10px]" style={{ color: '#dc2626' }}>{errorMsg}</div>
          </div>
          <button
            onClick={() => { setStep('upload'); setFile(null); setSummary(null); setErrorMsg(null); }}
            className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest border"
            style={{ borderColor: '#231F2015', color: '#231F2088' }}
          >
            Coba Lagi
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helper: build summary dari processed rows ──
function buildSummary(processed: ProcessedRow[]): ImportSummary {
  const matched = processed.filter(p => p.decision.action === 'match');
  const unmatched = processed.filter(p => p.decision.action === 'unmatched');
  const skipped = processed.filter(p => p.decision.action === 'skip');
  const totalExp = matched.reduce((s, p) => s + (p.decision.exp ?? 0), 0);
  const totalKoin = matched.reduce((s, p) => s + (p.decision.koin ?? 0), 0);
  const totalNominal = matched.reduce((s, p) => s + p.row.total_penjualan, 0);
  return { matched, unmatched, skipped, totalExp, totalKoin, totalNominal };
}
```

---

## src/pages/UnmatchedReview.tsx

```tsx
import React, { useState } from 'react';
import { IC, Av, Badge } from '../components/ui';
import type { Staff, Member, TierConfig, RoleConfig } from '../lib/types';
import { getTier } from '../lib/types';
import type { UnmatchedTransaction } from '../lib/types';

const REASON_LABELS: Record<string, string> = {
  no_phone: 'Tanpa HP',
  invalid_phone: 'HP Tidak Valid',
  phone_not_found: 'HP Tidak Terdaftar',
};

interface Props {
  staff: Staff;
  roles: RoleConfig[];
  tiers: TierConfig[];
  members: Member[];
  unmatchedTxs: UnmatchedTransaction[];
  onBack: () => void;
  resolveUnmatchedTx: (id: string, memberId: string, staffId: string, staffName: string) => Promise<boolean>;
  skipUnmatchedTx: (id: string, staffId: string, staffName: string, notes?: string) => Promise<boolean>;
  addTransaction: (tx: any) => Promise<boolean>;
  updateMemberBalance: (memberId: string, exp: number, koin: number) => Promise<boolean>;
}

export default function UnmatchedReviewPage({
  staff,
  tiers,
  members,
  unmatchedTxs,
  onBack,
  resolveUnmatchedTx,
  skipUnmatchedTx,
  addTransaction,
  updateMemberBalance,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const active = unmatchedTxs.find(u => u.id === activeId) ?? null;

  const memberResults = searchQ.length >= 2
    ? members.filter(m =>
        m.is_active && (
          m.full_name.toLowerCase().includes(searchQ.toLowerCase()) ||
          m.phone?.includes(searchQ) ||
          m.email.toLowerCase().includes(searchQ.toLowerCase())
        )
      ).slice(0, 8)
    : [];

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  };

  const doAssign = async (unmatched: UnmatchedTransaction, member: Member) => {
    setLoadingId(unmatched.id);
    try {
      const multiplier = Math.floor((unmatched.total_nominal || 0) / 10000);
      const exp = multiplier * 100;
      const koin = multiplier * 10;

      await addTransaction({
        member_id: member.id,
        exp_amount: exp,
        koin_amount: koin,
        description: `Import Majoo (manual assign) — ${unmatched.majoo_transaction_id || ''}`,
        preset_id: null,
        created_by: staff.id,
        staff_name: staff.full_name,
        source: 'majoo',
        majoo_import_id: unmatched.import_id,
        majoo_transaction_id: unmatched.majoo_transaction_id,
        nominal_amount: unmatched.total_nominal,
      });

      await updateMemberBalance(member.id, exp, koin);
      await resolveUnmatchedTx(unmatched.id, member.id, staff.id, staff.full_name);

      setActiveId(null);
      setSearchQ('');
      showFlash(`✓ Assigned ke ${member.full_name} — +${exp} EXP, +${koin} Koin`);
    } finally {
      setLoadingId(null);
    }
  };

  const doSkip = async (unmatched: UnmatchedTransaction) => {
    setLoadingId(unmatched.id);
    try {
      await skipUnmatchedTx(unmatched.id, staff.id, staff.full_name, 'Non-member');
      setActiveId(null);
      showFlash('Transaksi di-skip');
    } finally {
      setLoadingId(null);
    }
  };

  // ── Detail panel ──
  if (active) {
    const multiplier = Math.floor((active.total_nominal || 0) / 10000);
    const expEstimate = multiplier * 100;
    const koinEstimate = multiplier * 10;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { setActiveId(null); setSearchQ(''); }} style={{ color: '#231F2088' }}>{IC.back}</button>
          <h1 className="font-mono text-sm font-bold" style={{ color: '#231F20' }}>Assign Transaksi</h1>
          <div className="w-5" />
        </div>

        <div className="p-4 rounded-lg border space-y-2" style={{ borderColor: '#C39A4B33', background: '#C39A4B08' }}>
          <div className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: '#C39A4B' }}>Transaksi Unmatched</div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>No Transaksi</span>
            <span className="font-mono text-[10px] font-medium" style={{ color: '#231F20' }}>{active.majoo_transaction_id || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>Pelanggan</span>
            <span className="font-mono text-[10px] font-medium" style={{ color: '#231F20' }}>{active.majoo_customer_name || 'Guest'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>HP di Majoo</span>
            <span className="font-mono text-[10px] font-medium" style={{ color: '#231F20' }}>{active.majoo_phone || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>Total</span>
            <span className="font-mono text-[10px] font-bold" style={{ color: '#231F20' }}>
              Rp {(active.total_nominal || 0).toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>Alasan</span>
            <span className="font-mono text-[10px]" style={{ color: '#C39A4B' }}>
              {REASON_LABELS[active.reason || ''] || active.reason || '—'}
            </span>
          </div>
          {expEstimate > 0 && (
            <div className="flex justify-between pt-1 border-t" style={{ borderColor: '#C39A4B22' }}>
              <span className="font-mono text-[10px]" style={{ color: '#231F2088' }}>Akan dapat</span>
              <span className="font-mono text-[10px] font-bold text-green-600">+{expEstimate} EXP · +{koinEstimate} Koin</span>
            </div>
          )}
        </div>

        <div>
          <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#231F2066' }}>
            Cari member untuk di-assign
          </div>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#231F2066' }}>{IC.search}</div>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border font-mono text-sm focus:outline-none focus:border-[#C39A4B]"
              style={{ borderColor: '#231F2015', color: '#231F20' }}
              placeholder="Nama, HP, atau email..."
              autoFocus
            />
          </div>

          {searchQ.length >= 2 && (
            <div className="mt-2 space-y-1.5">
              {memberResults.length === 0
                ? <p className="font-mono text-xs text-center py-4" style={{ color: '#231F2088' }}>Tidak ditemukan</p>
                : memberResults.map(m => {
                    const tier = getTier(m.total_exp, tiers);
                    return (
                      <button
                        key={m.id}
                        onClick={() => doAssign(active, m)}
                        disabled={loadingId === active.id}
                        className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-[#C39A4B55] text-left disabled:opacity-50"
                        style={{ borderColor: '#231F2015' }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Av name={m.full_name} size={36} tier={tier} />
                          <div className="min-w-0">
                            <div className="font-mono text-xs font-medium truncate" style={{ color: '#231F20' }}>{m.full_name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge tier={tier} />
                              {m.phone && <span className="font-mono text-[10px]" style={{ color: '#231F2066' }}>{m.phone}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="font-mono text-[10px] font-bold shrink-0" style={{ color: '#C39A4B' }}>Assign →</div>
                      </button>
                    );
                  })
              }
            </div>
          )}
        </div>

        <div className="pt-2 border-t" style={{ borderColor: '#231F2010' }}>
          <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: '#231F2066' }}>
            Atau lewati transaksi ini
          </div>
          <button
            onClick={() => doSkip(active)}
            disabled={loadingId === active.id}
            className="w-full py-2.5 rounded-lg font-mono text-[10px] uppercase tracking-widest border disabled:opacity-50"
            style={{ borderColor: '#231F2015', color: '#231F2088' }}
          >
            Skip — Bukan Member
          </button>
        </div>
      </div>
    );
  }

  // ── Daftar unmatched ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} style={{ color: '#231F2088' }}>{IC.back}</button>
        <h1 className="font-mono text-sm font-bold" style={{ color: '#231F20' }}>Review Unmatched</h1>
        <div className="w-5" />
      </div>

      {flash && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center font-mono text-xs text-green-700 font-bold">
          {flash}
        </div>
      )}

      {unmatchedTxs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="font-mono text-3xl">✓</div>
          <div className="font-mono text-sm font-bold" style={{ color: '#003820' }}>Semua sudah ditangani</div>
          <div className="font-mono text-[10px]" style={{ color: '#231F2066' }}>Tidak ada transaksi yang perlu direview</div>
        </div>
      ) : (
        <>
          <p className="font-mono text-[10px]" style={{ color: '#231F2066' }}>
            {unmatchedTxs.length} transaksi menunggu — tap untuk assign ke member atau skip
          </p>

          <div className="space-y-2">
            {unmatchedTxs.map(u => (
              <button
                key={u.id}
                onClick={() => setActiveId(u.id)}
                className="w-full p-3 rounded-lg border text-left hover:border-[#C39A4B55]"
                style={{ borderColor: '#231F2015' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs font-medium truncate" style={{ color: '#231F20' }}>
                      {u.majoo_customer_name || 'Guest'}
                    </div>
                    <div className="font-mono text-[10px] mt-0.5" style={{ color: '#231F2066' }}>
                      {u.majoo_phone || 'Tanpa HP'} · {u.majoo_transaction_id || '—'}
                    </div>
                    <span className="inline-block mt-1 font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#C39A4B15', color: '#C39A4B' }}>
                      {REASON_LABELS[u.reason || ''] || u.reason || '—'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-xs font-bold" style={{ color: '#231F20' }}>
                      Rp {(u.total_nominal || 0).toLocaleString('id-ID')}
                    </div>
                    <div className="font-mono text-[10px] font-bold shrink-0 mt-1" style={{ color: '#C39A4B' }}>Review →</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

---

## src/lib/db.ts — Majoo functions

```typescript
const updateMemberBalance = async (memberId: string, addExp: number, addKoin: number) => {
  const member = members.find(m => m.id === memberId);
  if (!member) return false;

  const { error } = await supabase
    .from('members')
    .update({
      total_exp: member.total_exp + addExp,
      coin_balance: member.koin_balance + addKoin
    })
    .eq('id', memberId);

  if (!error) {
    setMembers(p => p.map(m => m.id === memberId
      ? { ...m, total_exp: m.total_exp + addExp, koin_balance: m.koin_balance + addKoin }
      : m
    ));
  }
  return !error;
};

// ── Cari member berdasarkan normalized phone ──
const findMemberByPhone = async (normalizedPhone: string): Promise<Member | null> => {
  const { data } = await supabase
    .from('members')
    .select('*')
    .eq('phone_normalized', normalizedPhone)
    .limit(1);
  return data && data.length > 0 ? toMember(data[0]) : null;
};

// ── Simpan hasil import Majoo ke DB ──
const createMajooImport = async (payload: Omit<MajooImport, 'id' | 'imported_at'>): Promise<MajooImport | null> => {
  const { data, error } = await supabase.from('majoo_imports').insert(payload).select().single();
  if (error || !data) return null;
  const record = toMajooImport(data);
  setMajooImports(p => [record, ...p]);
  return record;
};

const updateMajooImport = async (id: string, updates: Partial<MajooImport>) => {
  const { error } = await supabase.from('majoo_imports').update(updates).eq('id', id);
  if (!error) setMajooImports(p => p.map(m => m.id === id ? { ...m, ...updates } : m));
  return !error;
};

// ── Tambah unmatched transaction ke queue ──
const addUnmatchedTx = async (payload: Omit<UnmatchedTransaction, 'id' | 'created_at'>) => {
  const { data, error } = await supabase.from('unmatched_transactions').insert(payload).select().single();
  if (!error && data) setUnmatchedTxs(p => [toUnmatched(data), ...p]);
  return !error;
};
```

---

## src/lib/types.ts — Majoo types

```typescript
// Sumber transaksi: manual (scan preset) atau majoo (import file)
export type TransactionSource = 'manual' | 'majoo';

// ── Majoo Import ──
// Satu record per file yang di-upload admin
export interface MajooImport {
  id: string;
  imported_at: string;
  imported_by: string | null;
  imported_by_name: string | null;
  file_name: string | null;
  periode_start: string | null;
  periode_end: string | null;
  total_rows: number;
  matched_count: number;
  unmatched_count: number;
  skipped_count: number;
  total_exp_added: number;
  total_koin_added: number;
  total_nominal: number;
  status: 'pending' | 'completed' | 'failed' | 'rolled_back';
  notes: string | null;
  skip_reasons: Record<string, number> | null;
}

// ── Unmatched Transaction ──
// Transaksi dari Majoo yang tidak bisa di-match ke member manapun
export type UnmatchedReason = 'no_phone' | 'invalid_phone' | 'phone_not_found';
export type UnmatchedStatus = 'pending' | 'assigned' | 'skipped';

export interface UnmatchedTransaction {
  id: string;
  import_id: string | null;
  majoo_transaction_id: string | null;
  majoo_phone: string | null;
  majoo_phone_normalized: string | null;
  majoo_customer_name: string | null;
  transaction_date: string | null;
  total_nominal: number;
  reason: UnmatchedReason | null;
  status: UnmatchedStatus;
  assigned_member_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolved_by_name: string | null;
  notes: string | null;
  created_at: string;
}
```

---

## supabase/migrations/20260518000000_majoo_integration.sql

```sql
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
```
