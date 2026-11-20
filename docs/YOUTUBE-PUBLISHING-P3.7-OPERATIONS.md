# P3.7 — Operational Dashboard & Alerting

## Delivered

- Authenticated, per-user operational API: `GET /api/youtube/publish/operations`.
- Queue metrics scoped to the signed-in user's YouTube publications.
- Scheduler health from the protected P3.6 heartbeat, with no cron secret exposed to the browser.
- Alerts for missing/stale heartbeat, stale upload leases, overdue scheduled publications, and exhausted retry budgets.
- Recent activity for failed, uploading, and scheduled publications, including attempt counts and sanitized-by-ownership error visibility.
- Publishing dashboard refreshes operational data with the existing five-second refresh cycle.

## Access and data boundaries

The operations API requires a valid application session. Publication metrics and activity are filtered by `session.user.id`; no other user's publication title, channel, or error is returned. The scheduler heartbeat is global operational state and contains only run metadata. The cron bearer secret is never returned to the client.

## Alert semantics

Dashboard alerts are state-derived and recomputed on refresh; they are not durable notification records and do not send email, SMS, or third-party webhooks. This avoids creating repeated notification rows every five seconds. External alert delivery can consume the protected P3.6 health endpoint from a secret-managed monitoring service.

## Validation

Run `bun run db:generate`, `bun run typecheck`, `bun run lint`, `bun test`, and `bun run build`. Verify unauthenticated operations API returns 401, user-scoped metrics do not include another account's records, and the dashboard displays worker state and alerts.

## Operational limitation

The heartbeat stores the most recent scheduler invocation, not a historical run ledger. The dashboard therefore shows the latest run and recent publication activity; persistent multi-run history is a separate follow-up requiring a dedicated event/run table or log aggregation.
