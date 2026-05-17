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
