# AIVISO — YouTube Publishing Reliability & Operations Workstream

> **Penjelasan penomoran:** dokumen ini memakai label historis submilestone YouTube Publishing `P3.1–P3.9`. Label tersebut adalah namespace workstream teknis dan **bukan** Master PHASE 3 AIVISO. Master PHASE 3 adalah Market & Opportunity Engine. Master roadmap berada di [AIVISO-MASTER-ROADMAP.md](./AIVISO-MASTER-ROADMAP.md).

**Status terakhir terdokumentasi: YouTube Publishing P3.8.** Branch pengembangan: `adhitiad_gpt`. YouTube Publishing P3.9 adalah kandidat tahap berikutnya, belum dimulai.

## Scope workstream

Workstream ini mengelola reliabilitas alur publikasi YouTube: upload foundation, resumable upload, scheduler, preflight, observability, operations dashboard, worker history, persistent alerts, notification delivery, escalation, external webhook, dan guarded recovery.

Workstream melintasi master PHASE 2 (YouTube integration), PHASE 5 (production), dan PHASE 8 (engineering quality). Ia bukan pengganti atau batas akhir roadmap produk.

## YouTube Publishing submilestones (legacy IDs)

| Milestone | Fokus | Status |
|---|---|---|
| Publishing P3.1 | Publishing foundation, API, OAuth upload scope, worker/scheduler foundation | Selesai menurut riwayat proyek |
| Publishing P3.2 | Resumable upload reliability, retry/recovery, session reconciliation, dashboard | Selesai menurut riwayat proyek |
| Publishing P3.3 | Scheduled worker workflow, retry configuration, CI/test integration | Selesai menurut riwayat proyek |
| Publishing P3.4 | YouTube preflight dan scheduled publishing safeguards | Selesai menurut riwayat proyek |
| Publishing P3.5 | Production live publishing runbook | Runbook selesai; live upload belum diverifikasi |
| Publishing P3.6 | Observability dan production readiness | Implementasi/CI selesai; production runtime belum diverifikasi |
| Publishing P3.7 | Operational dashboard dan state-derived alert visibility | Implementasi/CI selesai; production runtime belum diverifikasi |
| Publishing P3.8 | Durable worker execution history, persistent alert lifecycle, in-app notification delivery | Implementasi/CI selesai; schema deployment dan production delivery belum diverifikasi |
| Publishing P3.9 | Alert escalation, external webhook integration, recovery automation | **Belum dimulai — proposal** |

## Milestone exit criteria

Sebuah milestone hanya boleh berstatus selesai jika:
1. Scope dan acceptance criteria terpenuhi.
2. Implementasi sudah berada pada branch yang ditetapkan.
3. Typecheck, lint, tests, Prisma generation (jika relevan), dan production build lulus.
4. Tidak ada regression blocker yang diketahui.
5. Dokumentasi dan handoff diperbarui.
6. Production-only claims dipisahkan dari hasil CI/staging.

## Publishing P3.8 delivered scope

- Durable scheduler run records melalui `YoutubeWorkerRun`.
- Persistent alert lifecycle melalui `YoutubePublishingAlert`.
- Dedupe key pada notifikasi in-app.
- Operations API mengembalikan history terbaru dan active alerts.
- Dashboard menampilkan execution history dan alert timestamps.
- Scheduler POST dan protected health GET melakukan alert synchronization.

## Publishing P3.8 limitations

- Notifikasi yang diimplementasikan adalah in-app; email/SMS/push/third-party webhook belum tersedia.
- External monitor perlu dikonfigurasi untuk polling protected health GET agar stale heartbeat dapat dideteksi ketika scheduled POST berhenti.
- Run yang prosesnya mati sebelum finalisasi dapat tertinggal dalam status `running`; stale-running reconciliation menjadi perhatian task berikutnya.
- Database schema deployment dan end-to-end notification delivery pada production belum diverifikasi.
- CI success tidak membuktikan deployment atau integrasi YouTube live.

## Candidate Publishing P3.9 sequence

Task rinci: [P3.9 Next Task](../tasks/P3.9-NEXT.md).

1. Stale-running execution detection dan reconciliation policy.
2. Alert acknowledgement/snooze/escalation lifecycle dan severity policy.
3. External webhook delivery dengan signing, timeout, retry/backoff, idempotency, dan delivery ledger.
4. Recovery automation terbatas dengan guardrails, dry-run, audit log, dan kill switch.
5. Tests untuk duplicate delivery, concurrent scheduler, provider outage, secret rotation, dan cross-user isolation.
6. Runbook staging/production serta operational dashboard untuk delivery attempts.

P3.9 perlu dipecah menjadi task terukur sebelum implementasi. Jangan mengaktifkan recovery otomatis yang dapat mengulang upload YouTube tanpa reconciliation dan approval guard.
