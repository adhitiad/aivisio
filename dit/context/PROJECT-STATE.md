# AIVISO Project State

**Last documented milestone:** YouTube Publishing P3.8  
**Repository:** `adhitiad/aivisio`  
**Working branch:** `adhitiad_gpt`  
**Last verified branch HEAD at handoff preparation:** `ad23709628b78ca58eada4a96b21d2488c978ffa`  
**P3.8 CI run:** [GitHub Actions #44715070616](https://github.com/adhitiad/aivisio/actions/runs/44715070616)  
**Main branch:** tidak menjadi target perubahan pada pekerjaan ini.

> Selalu fetch ulang branch dan cek CI terbaru. SHA di atas adalah snapshot dokumentasi, bukan asumsi HEAD permanen.

## Milestone status

- P3.1–P3.4: selesai menurut riwayat implementasi proyek.
- P3.5: runbook live publishing tersedia; tidak ada bukti live upload dan verifikasi YouTube Studio.
- P3.6: observability/production readiness diimplementasikan dan CI lulus; production runtime belum diverifikasi.
- P3.7: operational dashboard dan alert visibility diimplementasikan dan CI lulus; production runtime belum diverifikasi.
- P3.8: execution history, persistent alerts, dan in-app notifications diimplementasikan dan CI lulus; production schema rollout dan end-to-end delivery belum diverifikasi.
- P3.9: proposal task; belum dimulai.

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

- In-app notification adalah satu-satunya delivery channel yang tercatat untuk P3.8.
- External uptime monitor perlu dikonfigurasi untuk polling protected scheduler GET; konfigurasi monitor belum dibuktikan aktif.
- Run yang prosesnya mati sebelum update terminal dapat tertinggal `running`.
- Heartbeat hanya bukti scheduler invocation, bukan bukti upload sukses.
- Stale upload lease bukan bukti bahwa YouTube gagal membuat video.
- Production deploy, database schema application, real notification delivery, dan live YouTube upload belum diverifikasi dari bukti yang tersedia.
- Jangan meminta atau menaruh OAuth/refresh token, client secret, cron secret, cookie, atau credential di chat/commit.

## Repository rules

- Sumber aturan utama: `docs/RULES.md`.
- Branch kerja: `adhitiad_gpt`; jangan sentuh `main` tanpa instruksi eksplisit.
- Commit dan push hanya setelah perintah eksplisit pemilik.
- Jangan menghapus/memindahkan file, folder, skill, scaffold, atau generated code tanpa persetujuan.
- Pertahankan direktori `skills/` yang sudah ada. Jangan membuat `skils/` sebagai duplikat typo.
- UI harus bilingual Indonesia/Inggris dan mendukung light/dark theme.
- Semua model Prisma baru wajib `createdAt` dan `updatedAt`; tambahkan indexes yang relevan.

## Next step

Task kandidat adalah `dit/tasks/P3.9-NEXT.md`. Tunggu persetujuan pemilik sebelum implementasi dan klarifikasi open decisions di task tersebut.
