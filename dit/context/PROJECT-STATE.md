# AIVISO Project State

**Master roadmap:** PHASE 0–PHASE 8  
**Last documented YouTube Publishing milestone:** P3.8  
**Repository:** `adhitiad/aivisio`  
**Working branch:** `adhitiad_gpt`  
**Main baseline synced before this documentation update:** `08655899178ab98995f3ab86ba4545f89fc6b056`  
**PR #5 merge commit:** `e0bae09e08f3e2e7e0ac00b07060f25fa64aedc6`  
**PR #5 validation CI:** [GitHub Actions #44716846919](https://github.com/adhitiad/aivisio/actions/runs/44716846919) — success  
**PR #5 review/security checks:** Kilo Code Review and GitGuardian — success at the time of verification.

> Snapshot dokumentasi, bukan asumsi HEAD permanen. Selalu fetch branch dan cek HEAD/CI terbaru sebelum bekerja.

## Roadmap identity

AIVISO mempunyai master product phases PHASE 0–PHASE 8. Prioritas fitur P0/P1/P2 adalah priority classification, bukan nomor phase.

YouTube Publishing Reliability & Operations adalah workstream teknis lintas fase. Label historis P3.1–P3.9 pada workstream ini bukan Master PHASE 3. Lihat:
- `dit/workflows/AIVISO-MASTER-ROADMAP.md`
- `dit/context/ROADMAP-NUMBERING.md`
- `dit/workflows/YOUTUBE-PUBLISHING-ROADMAP.md`

## Master phase status snapshot

- **Master PHASE 0:** Neon Object Storage dan Redis/durable video queue memiliki dokumentasi implementasi; full repository audit sign-off dan operational verification harus dicek.
- **Master PHASE 1:** security controls serta role OWNER/ADMIN/CREATOR terdokumentasi; audit seluruh endpoint dan acceptance akhir tetap wajib diverifikasi.
- **Master PHASE 2:** OAuth YouTube, private Analytics, dan public market data memiliki dokumentasi implementasi; full scope intelligence engine belum dianggap selesai.
- **Master PHASE 3:** public market discovery dan deterministic Opportunity Score v1 terdokumentasi; full demand/competition/content-gap model belum dianggap selesai.
- **Master PHASE 4:** actual revenue/RPM serta scenario baseline terdokumentasi; sponsorship, affiliate, product revenue, dan continuous forecasting masih perlu bukti/implementasi.
- **Master PHASE 5:** durable video worker/pipeline dan rights metadata catalog tersedia; rights clearance, asset ingestion, fact-checking, dan full quality workflow belum dianggap selesai.
- **Master PHASE 6:** thumbnail variant baseline terdokumentasi; full three-concept/title experiment acceptance belum terverifikasi.
- **Master PHASE 7:** end-to-end post-publish feedback loop belum terverifikasi.
- **Master PHASE 8:** CI, worker, tests, structured logging/observability memiliki fondasi; quality engineering adalah gate berkelanjutan.

Status ini harus diperbarui saat ada evidence baru; jangan menandai fase done hanya berdasarkan roadmap atau UI.

## YouTube Publishing workstream status

- Publishing P3.1–P3.4: selesai menurut riwayat implementasi/CI.
- Publishing P3.5: live publishing runbook tersedia; live upload dan YouTube Studio verification belum dibuktikan.
- Publishing P3.6: observability/production readiness diimplementasikan dan CI lulus; production runtime belum diverifikasi.
- Publishing P3.7: operations dashboard/state-derived alerts diimplementasikan dan CI lulus; production runtime belum diverifikasi.
- Publishing P3.8: execution history, persistent alerts, dan in-app notifications diimplementasikan dan CI lulus; production schema rollout dan end-to-end delivery belum diverifikasi.
- Publishing P3.9: proposal task; belum dimulai dan memerlukan approval serta keputusan open decisions.

## P3.8 code-level additions

- `YoutubeWorkerRun`: durable scheduler run lifecycle.
- `YoutubePublishingAlert`: per-user persistent alert state dengan fingerprint dan active/resolved status.
- `Notification.dedupeKey`: unique dedupe key untuk notifikasi.
- `src/lib/youtube/publishing-alerts.ts`: sinkronisasi alert dan in-app notification.
- Scheduler POST dan protected scheduler GET memicu alert synchronization.
- Operations API mengembalikan history dan alert aktif.
- Publishing dashboard menampilkan riwayat eksekusi dan alert timestamps.

Verifikasi ulang schema, route, dan response contract sebelum mengubahnya.

## Operational caveats

- In-app notification adalah satu-satunya delivery channel yang tercatat untuk Publishing P3.8.
- External uptime monitor perlu dikonfigurasi untuk polling protected scheduler GET; konfigurasi monitor belum dibuktikan aktif.
- Run yang prosesnya mati sebelum update terminal dapat tertinggal `running`.
- Heartbeat hanya bukti scheduler invocation, bukan bukti upload sukses.
- Stale upload lease bukan bukti bahwa YouTube gagal membuat video.
- Production deploy, database schema application, real notification delivery, dan live YouTube upload belum diverifikasi dari bukti yang tersedia.
- Jangan meminta atau menaruh OAuth/refresh token, client secret, cron secret, cookie, atau credential di chat/commit.

## Repository rules

- Sumber aturan utama: `docs/RULES.md`.
- Branch kerja: `adhitiad_gpt`; jangan ubah `main` secara langsung kecuali ada instruksi eksplisit.
- Commit dan push hanya setelah perintah eksplisit pemilik.
- Jangan menghapus/memindahkan file, folder, skill, scaffold, atau generated code tanpa persetujuan.
- Pertahankan direktori `skills/` yang sudah ada. Jangan membuat `skils/` sebagai duplikat typo.
- UI harus bilingual Indonesia/Inggris dan mendukung light/dark theme.
- Semua model Prisma baru wajib `createdAt` dan `updatedAt`; tambahkan indexes yang relevan.

## Next step

- Ikuti master phase yang ditugaskan dalam [Master Roadmap](../workflows/AIVISO-MASTER-ROADMAP.md).
- Untuk YouTube Publishing workstream, task kandidat adalah `dit/tasks/P3.9-NEXT.md`. Tunggu approval dan klarifikasi open decisions sebelum implementasi.
