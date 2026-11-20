# Durable Video Worker

Video job state is stored in PostgreSQL. The web request creates VideoProject and VideoJob in one transaction, while rendering runs in a separate worker.

Run bun run db:generate, bun run db:push, then start the web app and bun run worker:video. Both processes require the same DATABASE_URL, AI provider credentials, FFmpeg and ffprobe binaries, and persistent media/videos filesystem. Different hosts need the same shared volume mounted at the same application path; ephemeral serverless local storage is not supported.

Workers claim jobs through conditional updates, renew a heartbeat lease, and can reclaim jobs after an expired lease. Failures retry with exponential backoff capped at 30 minutes; exhausted attempts become failed. A retry restarts pipeline planning, so AI provider calls may repeat after a crash and exactly-once external API execution is not guaranteed.

VIDEO_WORKER_POLL_MS defaults to 2500; VIDEO_WORKER_LEASE_MS to 180000 (minimum 60000); VIDEO_WORKER_MAX_ATTEMPTS to 4 (maximum 10). Monitor VideoJob status, attempts, availableAt, heartbeatAt, lockedBy and lastError.
