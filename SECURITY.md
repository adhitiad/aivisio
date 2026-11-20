# Keamanan AIVISO

Dokumen ini menjelaskan kebijakan pelaporan kerentanan dan kontrol keamanan yang
saat ini diimplementasikan di AIVISO. Ringkasan ini mengacu pada OWASP Top 10
(edisi 2025) dan harus diperbarui setelah perubahan arsitektur autentikasi,
database, deployment, atau endpoint.

**Tinjauan terakhir:** 20 November 2026

## Pelaporan kerentanan

Laporkan dugaan kerentanan secara bertanggung jawab melalui:

- formulir **Hubungi Kami** pada `/contact` dengan subjek `Security Report`;
- saluran kontak resmi yang ditampilkan oleh pemilik situs; atau
- issue privat pada pemilik repository, jika fitur itu tersedia.

Dalam laporan, sertakan:

- versi atau commit aplikasi yang diuji;
- langkah reproduksi yang spesifik;
- dampak yang dapat diamati;
- bukti minimum yang membuktikan masalah; dan
- saran mitigasi, jika tersedia.

Mohon jangan mengakses data milik pengguna lain, mengubah data produksi,
melakukan denial-of-service, atau mempublikasikan detail sebelum perbaikan.
Kontak yang menerima laporan akan mengakui penerimaan dan menentukan rencana
penanganan. AIVISO tidak menjanjikan bug bounty atau imbalan finansial.

## Versi yang didukung

| Versi | Status |
|---|---|
| `main` / rilis terbaru | Didukung |
| Versi lama sebelum rilis/pembaruan keamanan terbaru | Tidak dijamin mendapat patch |

Karena aplikasi tidak memiliki proses rilis dan kebijakan lifecycle terpublikasi,
pengguna produksi harus memverifikasi keamanan commit yang dijalankan dan
menyerap pembaruan dari repository secara berkala.

## Deployment yang disarankan

- Jalankan PostgreSQL dan aplikasi pada jaringan yang aman.
- Gunakan HTTPS dengan sertifikat valid dan set `SITE_URL` ke origin produksi.
- Set `BETTER_AUTH_SECRET` dari nilai acak yang kuat.
- Set `BETTER_AUTH_URL` dan `SITE_URL` secara konsisten.
- Set `OWNER_EMAILS` ke email OAuth terverifikasi untuk bootstrap OWNER awal.
- Gunakan kredensial OAuth Google/Facebook/Meta yang khusus untuk lingkungan
  production dan batasi redirect URI.
- Set `PROVIDER_ENCRYPTION_KEY` dan jalankan `bun run security:encrypt-provider-keys`
  untuk mengenkripsi API key provider lama.
- Jangan menyimpan `.env`, API key, token, atau kredensial lain di repository.
- Simpan data `.env` dan secret di secret manager/variabel platform produksi.
- Batasi akses database dan jangan mengekspos port PostgreSQL ke internet.
- Pulihkan output build, cache, dan database lokal yang sudah diabaikan Git
  sebelum audit repository.

## Kontrol implementasi

| OWASP 2025 | Kontrol saat ini | Lokasi |
|---|---|---|
| A01 Broken Access Control | OWNER/ADMIN diverifikasi server-side dari User.role atau OWNER_EMAILS terverifikasi. Pesan kontak, pengaturan global, dan AI provider memerlukan role admin. History/video menggunakan ownership user. Broadcast notification read/dismissal memakai receipt per pengguna. | `authorization.ts`, `api.messages.ts`, `api.settings.ts`, `api.notifications.ts`, `admin-gate.ts` |
| A02 Security Misconfiguration | Header CSP, HSTS, deny framing, nosniff, Referrer-Policy, Permissions-Policy, dan cross-domain policy diterapkan global. Secret environment tidak dilacak; error dan health response tidak mengekspos stack trace database. | `vite.config.ts`, `src/start.ts`, `.gitignore`, `api.health.ts` |
| A03 Software Supply Chain Failures | Dependency dikunci melalui `bun.lock`; GitHub Actions CI menjalankan install, Prisma generate, typecheck, lint, unit tests, dan build. Katalog `skills/` tetap perlu ditinjau. | `package.json`, `bun.lock`, `.github/workflows/ci.yml`, `skills/` |
| A04 Cryptographic Failures | OAuth token dienkripsi BetterAuth; provider API keys baru dienkripsi AES-256-GCM. Legacy provider keys harus dimigrasikan dengan script resmi. | `src/lib/auth.ts`, `src/lib/provider-secrets.ts`, `scripts/encrypt-provider-keys.ts`, `.env.example` |
| A05 Injection | Prisma digunakan untuk query database dan parameter `$queryRaw` literal; input di endpoint kritis dibatasi ukuran, divalidasi Zod, serta memakai allowlist field. Provider URL divalidasi terhadap SSRF. | `src/lib/db.ts`, `api.contact.ts`, `api.settings.ts`, `api.generate.ts`, `api.video.ts`, `provider-security.ts` |
| A06 Insecure Design | Formulir kontak dibatasi 5 permintaan per 10 menit per IP. BetterAuth memiliki rate limit umum dan aturan login/sign-up. Penandaan CAPTCHA bukan kontrol yang saat ini digunakan. | `src/lib/rate-limit.ts`, `api.contact.ts`, `src/lib/auth.ts` |
| A07 Authentication Failures | Hanya OAuth Google dan Facebook/Meta yang didukung. Session berlaku 30 hari dengan refresh 24 jam dan cache cookie lima menit. Tidak ada flow password, reset password, atau MFA aplikasi bawaan. | `src/lib/auth.ts`, `_protected.tsx`, `login.tsx` |
| A08 Software/Data Integrity Failures | Dependency melalui lockfile dan aset statis disajikan dari build aplikasi. Integrasi eksternal perlu tetap pada allowlist dan tidak boleh menerima kode/artefak yang tidak diaudit. | `bun.lock`, `vite.config.ts`, `src/lib/zai.ts`, `src/lib/video/` |
| A09 Security Logging and Alerting Failures | Pino mencatat event terstruktur dan me-redact authorization serta nilai `apiKey`. Penyimpanan log dan alert eksternal bergantung pada platform deployment dan belum disediakan kode aplikasi. | `src/lib/logger.ts`, `src/routes/` |
| A10 Mishandling Exceptional Conditions | Route mengembalikan status 400/401/404/429/500/503 yang konsisten, health check tanpa detail rahasia, dan error boundary global tersedia pada root. | `__root.tsx`, `api.health.ts`, `api*.ts` |

## Pembatasan kontrol yang perlu diketahui

1. **Role administration.**
   Global administration selalu memerlukan OWNER atau ADMIN. OWNER awal dibootstrap
   melalui OWNER_EMAILS yang diverifikasi; role lainnya harus diatur operator.

2. **OAuth perlu dikonfigurasi.**
   Tanpa Google dan/atau Facebook/Meta, provider yang tidak dikonfigurasi tidak
   tersedia. Hanya OAuth yang didukung; password tidak boleh ditambahkan.

3. **CSRF dan origin checks.**
   Middleware CSRF TanStack Start aktif untuk `serverFn`. Cookie-authenticated
   mutation API juga memeriksa Origin dan Fetch Metadata. Request server-to-server
   tanpa Origin tetap memerlukan autentikasi dan kontrol jaringan tersendiri.

4. **CSP belum memakai nonce.**
   CSP saat ini mengizinkan `'unsafe-inline'` untuk script/style agar
   hydration SSR berfungsi. Pencegahan XSS tetap memerlukan escaping, validasi,
   pembatasan sink, dan pengujian.

5. **Rate limit in-memory.**
   Limiter kontak dan BetterAuth default cocok untuk satu instance. Pada
   multi-instance atau serverless, gunakan store terpusat agar limit tidak
   mudah di-bypass melalui restart atau distribusi instance.

6. **Konfigurasi proxy perlu teliti.**
   Header forwarded pada autentikasi dan pengambil IP harus berasal dari
   proxy tepercaya. Konfigurasi proxy yang salah dapat menyebabkan identitas
   IP atau audit session tidak akurat.

7. **Tidak ada sistem yang sepenuhnya aman.**
   Kontrol tidak menggantikan review kode, pemindaian dependency, pengujian
   autentikasi, backup, pemantauan, dan respons insiden.

## Checklist sebelum rilis

- Jalankan `bun install --frozen-lockfile` pada lingkungan CI.
- Jalankan `bun run db:generate`.
- Jalankan `bun run typecheck` dan `bun run lint`.
- Jalankan `bun run build`.
- Pastikan `OWNER_EMAILS` dikonfigurasi dan role ADMIN hanya diberikan operator berwenang.
- Pastikan tidak ada `.env`, secret, atau output build ter-track.
- Uji OAuth dengan redirect URI produksi.
- Uji session, logout, 401, 403, validasi input, dan rate limit.
- Uji header HTTP melalui response development maupun production.
- Uji backup dan restore PostgreSQL.
- Konfigurasikan log retention dan alert untuk kegagalan autentikasi atau error.
- Jalankan audit dependency dan tinjau versi dependency yang terlock.

## Ruang lingkup laporan

Dalam ruang lingkup bila terkait dengan repository/deployment resmi AIVISO:

- autentikasi dan otorisasi;
- exposure secret atau data pengguna;
- injection pada database atau output web;
- CSRF dan session hijacking;
- SSRF atau penanganan provider eksternal;
- XSS dan kelemahan header keamanan;
- kelemahan signifikan pada upload, download, atau pemrosesan video.

Laporan tidak dianggap valid apabila hanya bergantung pada alat tanpa bukti
reproduksi, bersifat generic best-practice, atau menguji instance milik pengguna
tanpa izin.


## Phase 1 additions

See [docs/SECURITY-PHASE-1.md](docs/SECURITY-PHASE-1.md) for role bootstrap, provider credential encryption, SSRF controls, notification receipts, and the database update procedure.
