# P3.8 — Worker Execution History, Persistent Alerting & Notification Delivery

## Data model

- `YoutubeWorkerRun`: durable scheduler invocation record, created before processing and finalized on success/failure.
- `YoutubePublishingAlert`: per-user alert lifecycle with stable fingerprint, active/resolved state, first/last seen timestamps, and notification reference.
- `Notification.dedupeKey`: unique idempotency key for in-app alert delivery.

## Delivery behavior

The scheduler synchronizes alert state after every completed or failed invocation. New alert transitions create one in-app Notification for the affected user. Repeated scheduler executions update `lastSeenAt` without spamming duplicate notifications. When the underlying condition clears, the alert becomes resolved. If it recurs later, a new notification is delivered for that new activation.

Alert classes: missing heartbeat, degraded worker, stale upload lease, overdue scheduled publication, and failed publication requiring attention.

## APIs and dashboard

- `GET /api/youtube/publish/operations` returns the latest 20 durable worker runs and the signed-in user's active persistent alerts.
- The publishing dashboard shows execution history, duration, batch counts, error summary, alert severity and timestamps.
- Notifications use the existing in-app notification center; no email/SMS/third-party webhook provider is configured.

## Deployment

Run `bun run db:generate` and apply the additive schema changes using the repository's approved database deployment process (the project currently uses Prisma schema push in its scripts; validate against a backup/staging database first). Then deploy the application and trigger one scheduler invocation to create the first worker history row and synchronize alert states.

## Reliability and limitations

- A scheduler run is created before work begins; a process killed before finalization can leave a `running` record. Monitoring should treat old running records as interrupted invocations.
- Notification idempotency is enforced by a unique dedupe key per alert activation.
- Alert evaluation runs after scheduler invocations, not as a separate always-on monitor. If the scheduler stops entirely, existing users will not receive a newly generated stale-heartbeat notification until another scheduler invocation or an external monitor calls the health endpoint.
- No external email, SMS, push provider or webhook delivery is configured in this milestone.
