# SOP Majoo Integration — Nomono Staff App

## Ringkasan

Fitur ini memungkinkan admin mengimport data penjualan harian dari Majoo POS ke sistem loyalty Nomono. EXP dan Koin otomatis masuk ke member yang terdaftar berdasarkan nomor HP.

---

## Cara Kerja (Alur Harian)

1. **Member kasih nomor HP** ke kasir saat checkout di Majoo
2. **Kasir input nomor HP pelanggan** di transaksi Majoo
3. **Akhir hari**, admin export file dari Majoo
4. **Admin upload** file ke Nomono Staff App → EXP & Koin otomatis terbagi
5. Transaksi yang tidak match masuk ke **antrian review**

---

## Cara Export dari Majoo

1. Login ke dashboard Majoo
2. Buka menu **Laporan → Detail Penjualan**
3. Pilih tanggal (hari ini atau periode tertentu)
4. Pastikan template **"Nomono Sync"** aktif (tampilan default)
5. Klik **Export** → pilih format **Excel (.xlsx)**
6. Simpan file ke HP/komputer

> ⚠️ Harus pakai template "Nomono Sync" agar kolom sesuai. Kalau template tidak aktif, upload akan gagal dengan pesan error.

---

## Cara Import di Staff App

1. Buka **Staff App** → tap tab **Majoo** di bottom nav
2. Tap **Import File**
3. Pilih file .xlsx yang baru di-download dari Majoo
4. Cek **ringkasan preview**:
   - ✅ Matched = transaksi yang akan langsung diproses
   - ⚠️ Unmatched = nomor HP tidak terdaftar, perlu review manual
   - ⏭ Dilewati = belum lunas / total Rp 0 / refund / batal
5. Tap **Proses Import**
6. Selesai — lihat hasil di layar konfirmasi

---

## Kalkulasi EXP & Koin

| Nominal Transaksi | EXP | Koin |
|---|---|---|
| Rp 10.000 | +100 | +10 |
| Rp 20.000 | +200 | +20 |
| Rp 50.000 | +500 | +50 |
| Rp 75.000 | +700 | +70 |
| Rp 100.000 | +1.000 | +100 |

**Rumus:** `floor(nominal / 10.000) × 100 EXP` dan `× 10 Koin`

Sisa di bawah Rp 10.000 tidak dihitung (dibulatkan ke bawah).

---

## Transaksi yang Dilewati (Skip)

Sistem otomatis melewati transaksi berikut tanpa perlu aksi manual:

| Kondisi | Alasan |
|---|---|
| Status Pembayaran = "Belum Lunas" | Jangan kasih poin sebelum bayar |
| Total Penjualan = Rp 0 | Tidak ada nilai transaksi |
| Ada Tanggal/Jumlah Refund | Transaksi direfund |
| Status = "Batal" atau "Void" | Transaksi dibatalkan |
| No Transaksi sudah pernah diimport | Cegah poin dobel |

---

## Review Unmatched

Transaksi masuk ke antrian **Unmatched** jika:
- **Tanpa HP** — pelanggan tidak kasih nomor HP ke kasir
- **HP Tidak Valid** — format nomor HP tidak dikenali
- **HP Tidak Terdaftar** — nomor HP ada tapi belum daftar di Nomono

### Cara review:
1. Tap **Review Unmatched** di halaman Majoo (atau dari notifikasi di Dashboard)
2. Tap transaksi yang ingin ditangani
3. Pilih salah satu:
   - **Assign ke member** — cari member by nama/HP/email → tap Assign
   - **Skip** — kalau bukan member Nomono

---

## Permission

| Role | Import | Review Unmatched |
|---|---|---|
| Manager | ✅ | ✅ |
| Front Desk | ❌ | ❌ |
| F&B | ❌ | ❌ |
| Merchant | ❌ | ❌ |

Untuk mengubah permission, admin bisa edit di Settings → Roles.

---

## Database Migration

Sebelum fitur ini aktif di production, perlu apply migration SQL:

```
supabase/migrations/20260518000000_majoo_integration.sql
```

Migration ini **additive** (tidak menghapus data apapun). Menambahkan:
- Kolom `phone_normalized` dan `majoo_synced_at` di tabel `members`
- Kolom `source`, `majoo_import_id`, dll di tabel `transactions`
- Tabel baru `majoo_imports`
- Tabel baru `unmatched_transactions`
- Fungsi & trigger normalisasi nomor HP

> ⚠️ Koordinasikan dengan Nix sebelum apply ke production Supabase.

---

## Tips

- Import sebaiknya dilakukan **setiap hari** sebelum tutup, atau setiap pagi untuk hari sebelumnya
- Kalau ada member yang sering unmatched, pastikan kasir Majoo input nomor HP dengan benar
- Nomor HP yang valid: format Indonesia (08xx / +628xx / 628xx), 10-13 digit
- Cek **Riwayat Import** untuk audit kapan saja file di-upload dan siapa yang upload
