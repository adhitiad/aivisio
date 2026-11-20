---
name: youtube-publishing
description: Safely maintain AIVISO YouTube publishing, resumable uploads, scheduling, operations dashboard, worker history, persistent alerts, and notifications.
---

# YouTube Publishing Engineering Skill

## When to use

Gunakan skill ini untuk task di domain YouTube publishing, termasuk upload worker, resumable session, scheduler, queue, retries, dashboard, observability, alert lifecycle, notifications, dan dokumentasi P3.

## Mandatory context

Baca sebelum coding:
- `docs/RULES.md`
- `.agents/rules/20-youtube-publishing.md`
- `dit/context/PROJECT-STATE.md`
- `dit/context/AGENT-HANDOFF.md`
- Task aktif di `dit/tasks/`
- Dokumen milestone relevan di `docs/`

## Workflow

1. **Discover** — periksa branch/HEAD, routes, worker, Prisma schema, UI, tests, dan dokumentasi.
2. **Map behavior** — tulis alur saat ini, ownership boundary, state transitions, retry rules, dan failure modes.
3. **Plan minimal diff** — identifikasi file, schema impact, compatibility, tests, dan rollback.
4. **Implement** — pertahankan pola existing; validasi semua input; jaga auth dan per-user scope.
5. **Test** — jalankan Prisma generate bila schema berubah, typecheck, lint, tests, dan build.
6. **Review** — cari duplicate upload risk, race condition, stale lease, notification spam, cross-user leakage, secret leakage, dan error handling.
7. **Document** — update task, workflow, context, serta dokumen domain terkait.
8. **Report** — rangkum perubahan, hasil tes/CI, commit/branch (jika diizinkan), risiko dan pekerjaan tersisa.

## Design invariants

- Upload outcome yang ambigu harus direkonsiliasi sebelum retry.
- Lease/lock harus mencegah concurrent processing atas job yang sama.
- Retry harus bounded dan backoff-aware.
- Scheduler heartbeat bukan upload success.
- Execution history dan alert lifecycle harus durable.
- Alert activation harus idempotent terhadap polling berulang.
- Alert/notification hanya terlihat oleh pemilik yang berhak.
- Tidak ada external notification channel yang boleh diklaim aktif tanpa provider, secret configuration, dan end-to-end test.

## P3 roadmap boundary

- P3.1–P3.8: sudah tercatat selesai pada branch pengembangan, dengan batasan verifikasi yang dijelaskan di project state.
- P3.9: hanya proposal task berikutnya. Jangan mulai otomatis.
- Jika P3.9 scope berubah, update task dan roadmap terlebih dahulu setelah persetujuan pemilik.
