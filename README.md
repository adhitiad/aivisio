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
- Set `OWNER_EMAILS` ke email OAuth terverifikasi untuk bootstrap OWNER awal.
- Endpoint administrasi selalu memerlukan role OWNER atau ADMIN.
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


## Security & creator roles

Set OWNER_EMAILS to one or more comma-separated, verified OAuth email addresses to bootstrap the initial OWNER. Other users default to CREATOR. Promote additional administrators only through an authorized database operator; see [docs/SECURITY-PHASE-1.md](docs/SECURITY-PHASE-1.md).

Set PROVIDER_ENCRYPTION_KEY to a stable random secret before configuring AI provider credentials. If it is omitted, the application derives the credential-encryption key from BETTER_AUTH_SECRET. Existing plaintext provider keys can be encrypted with:

```bash
bun run security:encrypt-provider-keys
```

After pulling schema changes, run:

```bash
bun run db:generate
bun run db:push
```

Run quality checks with `bun run typecheck`, `bun run lint`, and `bun test`.


## YouTube SEA market research

AIVISO provides public market discovery through the YouTube Data API v3. Set `YOUTUBE_DATA_API_KEY` in the server environment and restrict the key to the YouTube Data API v3 and trusted server IPs.

Authenticated creators can call `POST /api/youtube/market/search` with a query, SEA market code, date window, sort order, and maximum result count. The service caches results for six hours and enforces a conservative daily quota guard.

This endpoint returns public video/channel statistics and relative sample velocity. It does **not** return keyword search volume, impressions, CTR, watch time, or private channel revenue. Those require separate sources and/or creator-authorized YouTube Analytics access.


## Private YouTube Analytics, market history, and opportunity scoring

- Connect a creator's YouTube channel at `/dashboard/analytics`. Daily private metrics can be backfilled and refreshed through the authenticated scheduler.
- Save up to five public market queries at `/dashboard/research`. The scheduled worker records public video observations every six hours, enabling measured momentum rather than lifetime views/day alone.
- Opportunity Score v1 ranks public video opportunities using documented momentum, lifetime view rate, engagement, subscriber reach, and freshness components. Scores include rationale and a confidence level.

Set `YOUTUBE_CRON_SECRET` on the application server. To activate the included GitHub scheduled workflow, set repository variable `AIVISO_BASE_URL` (for example `https://your-domain.example`) and repository secret `YOUTUBE_CRON_SECRET`. The workflow file must be merged into the repository's default branch for scheduled runs to execute. See [docs/YOUTUBE-OAUTH-ANALYTICS.md](docs/YOUTUBE-OAUTH-ANALYTICS.md) and [docs/YOUTUBE-MARKET-RESEARCH.md](docs/YOUTUBE-MARKET-RESEARCH.md).
