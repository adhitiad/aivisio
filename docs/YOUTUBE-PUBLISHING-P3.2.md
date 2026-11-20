# YouTube Publishing P3.2 — Reliability & Dashboard

## What changed

- Existing Google resumable sessions are probed before sending another byte. Google's acknowledged `Range` is authoritative after a timeout or process restart.
- Publishing jobs use a database lease. A worker can reclaim an `uploading` job after the 15-minute lease expires.
- Network, HTTP 408/429, and 5xx failures are rescheduled with exponential backoff and jitter. The default maximum is eight attempts.
- Permission and configuration errors stop automatic retries.
- Expired Google sessions are not silently recreated. The job fails and asks an operator to check YouTube Studio first to reduce duplicate uploads.
- The protected dashboard is available at `/dashboard/publishing` and supports create, approve, cancel, retry, progress, status, and history.

## Deployment checklist

1. Back up PostgreSQL.
2. Apply schema changes with `bun run db:push` (this repository currently uses Prisma db push and has no checked-in migration history).
3. Run `bun run db:generate`.
4. Configure `YOUTUBE_CRON_SECRET` with at least 32 random characters.
5. Schedule POST `/api/youtube/publish/scheduler` with `Authorization: Bearer <YOUTUBE_CRON_SECRET>` every minute.
6. Ensure Google OAuth grants `youtube.upload`. Existing connections must reconnect to grant the scope.
7. Verify the app server can read completed video objects from Neon Object Storage.

## Operational notes

- A YouTube scheduled video is uploaded as private immediately with `publishAt`; the worker does not wait until the scheduled time to upload.
- Manual retry starts a new resumable session. The dashboard warns the operator to verify YouTube Studio first after an expired or ambiguous session.
- Upload progress is based on bytes acknowledged by YouTube, not bytes merely read from object storage.
- Monitor YouTube Data API quota and channel upload limits.

## Validation

Run `bun run typecheck`, `bun test src/lib/youtube/publishing-utils.test.ts`, and `bun run build` in the repository environment after applying the schema. A source commit alone does not prove build or database migration success.
