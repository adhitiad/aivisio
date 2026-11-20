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
5. Configure the included `.github/workflows/youtube-publishing-worker.yml`: set `AIVISO_BASE_URL` as a repository variable and `YOUTUBE_CRON_SECRET` as a repository secret. It calls POST `/api/youtube/publish/scheduler` every five minutes.
6. Ensure Google OAuth grants `youtube.upload`. Existing connections must reconnect to grant the scope.
7. Verify the app server can read completed video objects from Neon Object Storage.

## Operational notes

- A YouTube scheduled video is uploaded as private immediately with `publishAt`; the worker does not wait until the scheduled time to upload.
- Manual retry starts a new resumable session. The dashboard warns the operator to verify YouTube Studio first after an expired or ambiguous session.
- Upload progress is based on bytes acknowledged by YouTube, not bytes merely read from object storage.
- Monitor YouTube Data API quota and channel upload limits.

## Validation

Run `bun run typecheck`, `bun test src/lib/youtube/publishing-utils.test.ts`, and `bun run build` in the repository environment after applying the schema. A source commit alone does not prove build or database migration success.

## GitHub Actions scheduling caveat

GitHub scheduled workflows execute only from the repository's default branch. The workflow can be manually dispatched from `adhitiad_gpt` for testing, but its five-minute schedule becomes active only after the workflow is merged into the default branch. Keeping `main` untouched means automated schedule activation remains pending until an approved merge or an external scheduler is configured.

The worker now respects each publication's `maxUploadAttempts` value. If a stale worker lease is reclaimed after the configured attempt limit has been exceeded, the publication is marked failed without starting another Google upload.
