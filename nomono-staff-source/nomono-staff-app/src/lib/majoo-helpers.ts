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
