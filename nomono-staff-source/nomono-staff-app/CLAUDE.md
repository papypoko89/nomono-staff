# CLAUDE.md — Nomono Staff App

> Konteks utama untuk Claude Code. Baca file ini dulu sebelum mulai kerja.

---

## 📌 Project Overview

Aplikasi **staff** untuk **Nomono Padel Club** (4 court padel di Jakarta). Bagian dari sistem loyalty & membership Nomono yang terdiri dari 2 app terpisah:

- **Member app** — repo: `papypoko89/nomono`
- **Staff app** — repo: `papypoko89/nomono-staff` (👈 ini repo aktif), live di `nomono-staff.vercel.app`

Owner: **Nix** (generalist, non-coder). Bahasa komunikasi: **Indonesia**, penjelasan singkat & langsung ke intinya.

Tools eksternal yang jalan paralel (di luar scope app ini):
- **AYO** — booking court
- **Majoo** — POS / back office

App Nomono fokus murni di **membership & loyalty**.

---

## 🛠️ Tech Stack

- **Framework:** Vite + React 19 + TypeScript
- **Styling:** Tailwind CSS 3.4
- **UI primitives:** Radix UI + shadcn-style components
- **Backend:** Supabase (`@supabase/supabase-js` 2.103)
- **Font:** DM Mono (Google Fonts)
- **Package manager:** pnpm
- **Deploy:** Vercel → `nomono-staff.vercel.app`

### Brand colors
```
#003820  — primary (deep green)
#C39A4B  — accent (gold)
#E0DBBC  — cream
#231F20  — dark text
#FAFAF7  — background
```

---

## 📁 Project Structure

Root proyek di repo: `nomono-staff-source/nomono-staff-app/`

```
nomono-staff-app/
├── src/
│   ├── App.tsx              # Root, routing manual via state, login gate
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client init
│   │   ├── db.ts            # useSupabaseData hook + CRUD + auth
│   │   └── types.ts         # Member, Staff, Role, Tier, perms
│   ├── components/
│   │   └── ui.tsx           # Icons (IC), RolePills, helpers fD/fT/ini
│   └── pages/
│       ├── Dashboard.tsx
│       ├── Scan.tsx         # QR scan + manual search + preset transaksi
│       ├── Members.tsx      # MembersPage, MemberDetailPage, MemberFormPage
│       └── Settings.tsx     # presets, tiers, roles, staff, profile
├── package.json
├── vite.config.ts           # alias "@" → ./src
└── tailwind.config.js
```

### Routing
Pakai state `page` di `App.tsx` (bukan react-router). Page values:
`'dashboard' | 'scan' | 'members' | 'member-detail' | 'member-form' | 'add-member' | 'settings'`

---

## 🧠 Core Concept

### Dual currency system
Setiap transaksi member dapat **dua mata uang sekaligus** dengan rasio 1:1 per Rp 10.000:
- **EXP** — lifetime, drives tier progression (tidak pernah berkurang)
- **Koin** — bisa di-redeem jadi reward

### Tier progression (4 tier)
1. **Rookie** — start
2. **Rally** — 500 EXP
3. **Smash** — 1.500 EXP
4. **Ace** — 4.000 EXP

Tiap tier punya diskon & perks yang naik. Konfigurasi tier disimpan di tabel `tier_settings`.

### Check-in
Member scan QR → dapat **+25 EXP** otomatis. Lalu staff bisa tambah preset transaksi (F&B, court, dll) yang ngasih EXP/Koin tambahan.

---

## 🗄️ Supabase

- **Project name:** nomono
- **Project ID:** `sysamlqxpdzgoanccjjt`
- **URL:** `https://sysamlqxpdzgoanccjjt.supabase.co`

### Tables
| Table | Purpose |
|---|---|
| `members` | Member data + `total_exp`, `koin_balance` |
| `staff` | Staff accounts + `role_slugs[]` (array) |
| `roles` | Role definitions + `toggle_perms` (JSONB) + `level_perms` (JSONB) |
| `tier_settings` | Tier config (Rookie/Rally/Smash/Ace) |
| `tx_presets` | Preset transaksi yang bisa di-tap staff |
| `checkins` | Log check-in member |
| `transactions` | Log semua transaksi EXP/Koin |
| `reward_catalog` | Katalog reward untuk redemption (dipakai member app) |
| `audit_log` | Audit trail |

### Auth (penting!)
Login staff **bukan** pakai Supabase Auth. Lihat `src/lib/db.ts` → `loginStaff()`:
- Query tabel `staff` by email
- Cek password hardcoded: **`nomono2025`** untuk semua staff
- Ini sengaja simple, bukan production-grade auth

### RLS — ⚠️ HATI-HATI
- RLS di Supabase **pernah disable** sementara untuk unblock dev
- RLS bisa bikin **silent 500 error** kalau policy salah
- Kalau query gagal aneh, cek RLS dulu sebelum debug code

### API Keys
File `.env` pakai **legacy JWT anon key** (yang working). Project juga punya format baru `sb_publishable_...` — keduanya valid tapi yang existing di .env adalah JWT.

---

## 🔐 RBAC System

Sistem permission **dynamic & slug-based**. 4 default roles:
- `manager` — full access
- `front_desk` — check-in + view members
- `fnb` — preset F&B
- `merchant` — preset merchant/retail

### Permission types
**Toggle perms** (boolean on/off) — disimpan di `roles.toggle_perms`:
- `checkin`
- `assign_activity`
- `view_members`
- `edit_members`
- `view_transactions`
- `approve_pin`

**Level perms** (none/view/modify) — disimpan di `roles.level_perms`:
- `master_presets`
- `master_tiers`
- `master_roles`
- `manage_staff`

### Cek permission di code
```ts
import { hasPerm, getLevel } from './lib/types';

hasPerm(curStaff, db.roles, 'checkin')           // → boolean
getLevel(curStaff, db.roles, 'master_presets')   // → 'none' | 'view' | 'modify'
```

Staff bisa punya **multiple role** (`role_slugs` is array). Permission digabung secara OR.

---

## 🚀 Development

### Setup
```bash
cd nomono-staff-source/nomono-staff-app
pnpm install
cp .env.example .env  # isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY
pnpm dev
```

### Scripts
```bash
pnpm dev       # local dev server
pnpm build     # tsc -b && vite build → output ke dist/
pnpm lint      # eslint
pnpm preview   # preview build
```

### Deploy
Push ke `main` di `papypoko89/nomono-staff` → Vercel auto-deploy ke `nomono-staff.vercel.app`.

---

## ⚠️ Known Issues & Gotchas

1. **Reference HTML vs source code** — pernah ada usaha rebuild source dari compiled HTML (`nomono-staff-app.html`). Source di `src/` adalah versi yang dipakai. Jangan kira HTML adalah source-of-truth.
2. **Compiled/minified HTML bukan substitute source code** — selalu kerja di `src/`.
3. **`koin_balance` vs `coin_balance`** — ada inkonsistensi di DB (lihat `db.ts` line `coin_balance: member.koin_balance + addKoin` di `updateMemberBalance`). App pakai `koin` tapi sebagian column lama `coin`. Hati-hati saat rename.
4. **Loading timeout** — `App.tsx` ada `forceReady` 5 detik supaya kalau Supabase lambat, app tetap render.
5. **Login fallback** — kalau staff query error, login otomatis fail. Pastikan tabel `staff` ada baris valid.

---

## 🎯 Current Priority

### Voucher / Redemption Flow (NEXT)
Bridge member ↔ staff app:
1. Member redeem reward di app member → Koin dipotong → voucher code di-generate
2. Member tunjukkan voucher (atau QR voucher)
3. Staff scan / input voucher di staff app → confirm redemption
4. Voucher status berubah jadi `redeemed`

Tabel terkait: `reward_catalog`, dan **mungkin perlu tabel baru** `vouchers` / `redemptions`.

### Beyond voucher
- Admin Dashboard (web-only, untuk manager/owner)
- Reporting & analytics

---

## 💬 Communication Notes

Owner (Nix) adalah generalist, bukan coder. Saat menjelaskan:
- **Singkat & langsung ke inti**
- Hindari jargon coding kalau bisa
- Kalau perlu pakai istilah teknis, kasih analogi sederhana
- Kalau prompt-nya kurang jelas, **tanya pertanyaan dasar dulu** sebelum mulai

Bahasa: **Indonesia** by default.
