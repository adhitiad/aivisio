# P3.6 — Production Readiness & Observability

## Scope

P3.6 adds operational visibility for the YouTube publishing worker without introducing a new database model or exposing creator data publicly. The existing PostgreSQL `Setting` model stores one compact scheduler heartbeat; PostgreSQL publication rows remain the source of truth.

## Protected observability endpoint

The endpoint is protected by the same bearer secret as the scheduler:

- `GET /api/youtube/publish/scheduler` — read operational metrics; returns `200` for healthy/unknown state, `503` when degraded.
- `POST /api/youtube/publish/scheduler` — execute one bounded publishing batch and persist a run heartbeat.

Send `Authorization: Bearer <YOUTUBE_CRON_SECRET>`. Never expose this secret in browser code, client logs, monitoring screenshots, or issue reports. Configure external uptime monitoring to call the GET endpoint from a secret store; do not put the bearer value in a URL.

## Metrics

The GET response reports:

- Publication counts grouped by status.
- Upload leases older than 15 minutes (including missing lease timestamps).
- Approved scheduled jobs overdue by more than 15 minutes.
- Oldest due publication timestamp and ID.
- Last scheduler run ID, status, start/completion timestamps, duration, eligible count, and attempted count.
- Age of the last completed scheduler run.

The endpoint returns `degraded` when there is a stale upload lease, overdue approved queue item, a failed scheduler invocation, or a completed scheduler heartbeat older than 15 minutes. It returns `unknown` before the first recorded scheduler completion; this is not a healthy signal and must be resolved during deployment validation.

## Structured logs and secret handling

Pino logs now include worker/run correlation IDs, publication IDs, retryability, attempt counters, batch sizes, and durations. Do not log OAuth tokens, authorization headers, encrypted resumable session URIs, raw session URLs, cookies, or cron secrets. Pino redaction covers common token/session fields and authorization headers.

## Alerting recommendations

Configure alerts from the protected endpoint or log aggregation:

1. HTTP 503 / `status=degraded`: page the operator.
2. `worker.staleUploads > 0`: inspect the lease and worker logs; do not manually retry an ambiguous upload.
3. `worker.overdueJobs > 0`: inspect scheduler cadence, deployment reachability, database health, and retry timestamps.
4. `worker.schedulerAgeSeconds > 900`: confirm the scheduler is still running.
5. Repeated `YouTube upload attempt failed` events for the same publication: inspect error class, attempt budget, OAuth scope, YouTube quota, and Object Storage availability.

Recommended initial alert thresholds are intentionally conservative. Tune them after observing real production upload duration and scheduler behavior.

## Deployment and validation

1. Back up PostgreSQL; no schema migration is required because heartbeat data uses the existing `Setting` table.
2. Deploy the tested commit and ensure `YOUTUBE_CRON_SECRET` is at least 32 characters.
3. Trigger the scheduler once manually; verify the POST returns a run ID and duration.
4. Call the protected GET endpoint; verify queue counts and a successful heartbeat.
5. Confirm an invalid/missing bearer token returns 401.
6. Confirm logs contain run/worker/publication correlation IDs but no credentials or session URI.
7. Trigger a controlled failure only in staging; verify the heartbeat records `error` and GET returns 503.
8. Run `bun run db:generate`, `bun run typecheck`, `bun run lint`, `bun test`, and `bun run build`.

## Scheduling caveat

GitHub Actions scheduled workflows run only from the repository default branch. Keeping `main` untouched means the five-minute schedule is not activated by this branch alone. Use `workflow_dispatch` for a controlled test on `adhitiad_gpt`, or configure an external scheduler until an approved merge.

## Safety notes

- A stale lease is an operational warning, not proof that YouTube did not create a video.
- Never invoke manual retry while upload outcome is ambiguous. Inspect YouTube Studio and reconcile the existing resumable session first.
- A heartbeat indicates scheduler execution, not proof of a successful YouTube upload. Use publication status and YouTube Studio for end-to-end confirmation.
- No live YouTube upload or production runtime check is claimed by this code change.
