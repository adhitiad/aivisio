# YouTube OAuth dan Analytics privat

## Google Cloud setup

1. Buat atau pilih Google Cloud project khusus AIVISO.
2. Enable **YouTube Data API v3** dan **YouTube Analytics API**.
3. Configure OAuth consent screen, testing/production audience, dan authorized domain.
4. Buat OAuth Client ID bertipe **Web application**. Jangan gunakan kredensial OAuth BetterAuth untuk alur ini.
5. Tambahkan authorized redirect URI yang persis sama dengan:
   `https://YOUR_DOMAIN/api/youtube/oauth/callback`
6. Isi environment server:
   - `YOUTUBE_OAUTH_CLIENT_ID`
   - `YOUTUBE_OAUTH_CLIENT_SECRET`
   - `YOUTUBE_OAUTH_REDIRECT_URI`
   - `YOUTUBE_TOKEN_ENCRYPTION_KEY` (secret acak minimal 32 karakter, stabil)
7. Backup database PostgreSQL, lalu jalankan `bun run db:generate` dan `bun run db:push`.

OAuth client terpisah ini tidak mengubah scope login Google/Facebook BetterAuth. AIVISO meminta persetujuan baca channel, YouTube Analytics, dan akses monetary read-only secara eksplisit pada halaman koneksi.

## Consent dan keamanan

- Authorization Code flow memakai state acak yang disimpan dalam bentuk SHA-256, terikat ke user AIVISO, kedaluwarsa 10 menit, dan hanya dapat dipakai sekali.
- PKCE S256 digunakan saat pertukaran authorization code.
- Access token, refresh token, dan PKCE verifier dienkripsi AES-256-GCM. Kunci berasal dari `YOUTUBE_TOKEN_ENCRYPTION_KEY`, fallback ke `PROVIDER_ENCRYPTION_KEY`, lalu `BETTER_AUTH_SECRET`.
- Jangan mengganti kunci enkripsi setelah token tersimpan. Jika kunci berubah/hilang, token lama tidak dapat didekripsi dan user harus menghubungkan ulang.
- Token tidak pernah dikirim ke browser atau dicatat ke log.
- Setiap channel dan query Analytics diverifikasi terhadap `userId` pemilik channel di database.
- Tombol disconnect mencoba mencabut token Google dan selalu menghapus token lokal serta state OAuth.
- Endpoint Analytics memakai rate limit per user dan cache-control `private, no-store`.

## Data yang tersedia

Laporan harian memakai YouTube Analytics API v2 `reports.query` dengan:
- `views`
- `estimatedMinutesWatched`
- `averageViewDuration`
- `subscribersGained`
- `subscribersLost`
- Opsional: `estimatedRevenue` dan `estimatedAdRevenue`

Pendapatan hanya diminta bila scope `yt-analytics-monetary.readonly` tercatat pada consent aktual. Permintaan pendapatan menggunakan `currency=IDR`. Nilainya adalah estimasi YouTube, bisa berubah karena penyesuaian akhir bulan, dan hanya tersedia bagi akun/channel yang memiliki izin monetisasi. Nilai ini bukan payout final.

Tanggal laporan menggunakan rentang maksimum 365 hari. YouTube dapat mengembalikan data hanya sampai hari terakhir ketika semua metrik sudah tersedia; tidak semua data hari terakhir yang diminta pasti sudah lengkap. AIVISO menyimpan snapshot harian untuk kebutuhan histori.

## Endpoints

- `POST /api/youtube/oauth/connect` — memulai koneksi OAuth.
- `GET /api/youtube/oauth/callback` — callback OAuth dan sinkronisasi channel.
- `GET /api/youtube/channels` — status koneksi serta channel milik user yang sedang login.
- `POST /api/youtube/analytics` — body JSON berisi `channelId`, `startDate`, `endDate`, dan `includeRevenue`; laporan Analytics.
- `POST /api/youtube/disconnect` — mencabut koneksi dan menghapus token.

Halaman dashboard: `/dashboard/analytics`.

Data metrik harian yang sudah disinkronkan tetap tersimpan setelah disconnect agar riwayat channel tidak hilang. Token Google dan relasi koneksi aktif dihapus; pengguna dapat meminta penghapusan data historis melalui prosedur penghapusan akun/data aplikasi.


## Automated private Analytics sync

The scheduled worker calls `GET /api/youtube/scheduler` with `Authorization: Bearer YOUTUBE_CRON_SECRET`. It performs a 365-day initial backfill for each eligible connected channel, then refreshes a 14-day overlap daily so late YouTube Analytics revisions are captured. The worker intentionally ends two Pacific calendar days behind the current date because recent daily reports may not be complete.

Set `YOUTUBE_CRON_SECRET` to a random 32+ character secret on the application server. Configure the GitHub repository variable `AIVISO_BASE_URL` and secret `YOUTUBE_CRON_SECRET` to enable `.github/workflows/youtube-scheduled-sync.yml`. The scheduled workflow runs every six hours; channel Analytics is throttled to at most once every 20 hours. The workflow must be present on the repository's default branch before GitHub scheduled events run.
