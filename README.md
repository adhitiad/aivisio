# AIVISO

AIVISO adalah aplikasi AI all-in-one berbasis TanStack Start untuk menghasilkan konten,
mengelola riwayat, menyiapkan video, serta mengatur provider dan pengguna.

## Stack

- TanStack Start + React 19 + Vite 8
- TypeScript 6
- Tailwind CSS 4 dan shadcn/ui
- BetterAuth dengan OAuth Google dan Facebook/Meta
- PostgreSQL dan Prisma 7
- TanStack Query, Table, Form, DB, dan Store
- i18next untuk bahasa Indonesia dan Inggris
- Bun sebagai package manager dan runtime tooling

## Fitur

- Generator konten AI dan riwayat hasil
- Pembuatan proyek video
- Pengelolaan provider AI
- Autentikasi OAuth tanpa kata sandi
- Dashboard, pengaturan situs, notifikasi, dan pesan kontak
- Mode terang dan gelap
- Header keamanan HTTP

## Persyaratan

- Bun
- PostgreSQL
- OAuth Google dan/atau Facebook/Meta

## Setup

1. Pasang dependencies:

   ```bash
   bun install
   ```

2. Salin konfigurasi lingkungan:

   ```bash
   cp .env.example .env
   ```

3. Isi `DATABASE_URL`, kredensial OAuth, `BETTER_AUTH_SECRET`, dan `SITE_URL`.
   Untuk mendapatkan secret lokal:

   ```bash
   openssl rand -base64 32
   ```

4. Sinkronkan dan hasilkan Prisma client:

   ```bash
   bun run db:generate
   bun run db:push
   ```

5. Jalankan aplikasi:

   ```bash
   bun run dev
   ```

Aplikasi tersedia di `http://localhost:3000`.

## Perintah

| Perintah | Fungsi |
|---|---|
| `bun run dev` | Menjalankan server pengembangan |
| `bun run build` | Membuat build produksi |
| `bun run start` | Menjalankan hasil `.output/server/index.mjs` |
| `bun run preview` | Menjalankan preview Vite |
| `bun run typecheck` | Memeriksa tipe TypeScript |
| `bun run lint` | Menjalankan ESLint |
| `bun run db:generate` | Menghasilkan Prisma client |
| `bun run db:push` | Sinkronisasi schema ke database |
| `bun run db:migrate` | Membuat dan menjalankan migrasi |
| `bun run db:reset` | Mereset database |
| `bun run auth:generate` | Memperbarui schema BetterAuth |

## Konfigurasi keamanan

- Jangan commit file `.env` atau kredensial.
- `ADMIN_API_GATE=1` mewajibkan OAuth untuk endpoint mutasi.
- Untuk deployment publik multi-user, aktifkan `ADMIN_API_GATE`.
- Gunakan HTTPS dan URL produksi yang konsisten pada `SITE_URL` serta redirect OAuth.
- Baca [SECURITY.md](SECURITY.md) untuk detail kontrol OWASP dan keputusan konfigurasi.

## Struktur

- `src/routes/` — route halaman dan API file-based TanStack Router
- `src/components/` — komponen UI
- `src/lib/` — autentikasi, database, session, dan layanan aplikasi
- `prisma/schema.prisma` — model database
- `messages/` — terjemahan UI Indonesia dan Inggris
- `public/` — aset statis

## Kontribusi

Ikuti aturan dan pola repository di [docs/RULES.md](docs/RULES.md) serta
[AGENTS.md](AGENTS.md). Teks antarmuka wajib ditambahkan ke `messages/id.json`
dan `messages/en.json`.
