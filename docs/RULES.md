# Aturan Proyek AIVISO (berlaku untuk semua kontributor & agen AI)

## Wajib — Database
- **Semua model wajib punya `createdAt` dan `updatedAt`.** Model baru tanpa keduanya akan ditolak PR.
- **Kolom yang dipakai untuk pencarian/filter/sort wajib diberi index** (`@@index`). Contoh: `toolId`, `status`, `createdAt`, `email`, `key`.
- Gunakan Prisma sebagai satu-satunya akses DB; dilarang raw SQL kecuali `$queryRaw` yang aman (tanpa string interpolation input user).

## Wajib — Dead code
- Sebelum menghapus file/folder/import/fungsi yang tidak terpakai (unused file, folder, import; dead code), **wajib minta konfirmasi ke pemilik repo**.
  - Dijawab "ok/ya/yes/boleh/silahkan" → laksanakan.
  - Dijawab "no/tidak/jangan/gak/ngga/engga/ga boleh" → jangan.
- Jangan diam-diam menghapus scaffold/generated/contoh yang tampak "tak terpakai".

## Wajib — Commit & Push
- **Jangan commit atau push tanpa perintah eksplisit.**
  - "O/ok commit" → baru boleh commit.
  - "O/ok push" → baru boleh push.
- Pesan commit mengikuti konvensi repo; jangan sebut nama model/agen AI.

## Wajib — Keamanan (OWASP Top 10, edisi 2025)
- Autentikasi hanya via OAuth (Google & Facebook/Meta). **Dilarang** menambah password auth.
- Validasi semua input API dengan zod; Prisma untuk anti-injection.
- Header keamanan aktif (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy) — lihat `vite.config.ts` dan `src/start.ts`.
- Secret hanya di `.env` (gitignored). Jangan pernah commit kredensial.
- Endpoint admin/mutasi baru wajib lewat `adminGate()` atau `getApiSession()` (lihat `src/lib/admin-gate.ts` dan `src/lib/session.ts`).

## Wajib — Kualitas
- Sebelum mengubah kode: baca & analisis codebase terkait terlebih dahulu.
- Error/loading/404 global selalu tersedia (`app/error.tsx`, `app/loading.tsx`, `app/not-found.tsx`, `app/global-error.tsx`).
- Bahasa UI: **Indonesia (default) & Inggris** via i18next (`messages/*.json`). Teks baru wajib ditambah di kedua file.
- Tema: light & dark wajib didukung (token semantik di `globals.css`, jangan hardcode warna).

## Wajib — Ikon & Logo
- Ikon: pakai lucide-react (satu library dengan katalog iconstack.io). Jika menambah ikon baru, cek dulu ketersediaannya di iconstack.io (`library=lucide`).
- Jika logo belum diisi di Pengaturan, tampil fallback bawaan (`SiteLogo` di `src/components/brand/site-logo.tsx`).
