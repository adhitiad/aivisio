# YouTube P1 — Niche Strategy & Revenue Optimization

## Pages
- /dashboard/strategy: per-channel niche profile, audience persona, positioning, content pillars, language, target cadence, Shorts/long-form guidance, hooks, outline, and CTA.
- /dashboard/revenue: private Analytics sync, channel RPM, per-video and per-country breakdowns, explainable recommendations, and saved target scenarios.

## Strategy snapshots
Creating a content idea from the Strategy page stores an immutable JSON snapshot of the profile version used at creation time. A later profile edit increments profileVersion; it does not rewrite old snapshots.

## YPP eligibility
Valid public watch hours and eligible Shorts views are entered manually from YouTube Studio. They are not inferred from total Analytics watch time or public video view counts. Store current values and the threshold shown to the channel owner; AIVISO does not hard-code a single monetization threshold for all eligibility tracks.

## Actual revenue vs. scenario
- Actual estimated revenue and RPM are read from YouTube Analytics with the yt-analytics-monetary.readonly scope.
- Monetary metrics can be unavailable for channels outside YPP or without the applicable permission. On a 403, the integration retries non-monetary reports and surfaces revenue as unavailable rather than manufacturing zero.
- Forecasts are labelled as what-if scenarios. Actual RPM is used only when there is a positive stored revenue baseline; otherwise the user must provide an assumed RPM.
- The default low/high sensitivity multipliers (0.8 / 1.2) are assumptions, not a statistical confidence interval.
- CTR and per-video retention are not inferred from views or watch time. They should be added only with supported Analytics report metrics and the required report dimensions.

## Deploy / verify
1. Review DATABASE_URL and take a database backup.
2. Apply the Prisma schema to the target database using the deployment's established migration process (bun run db:push is for schema push deployments).
3. Regenerate the Prisma Client (bun run db:generate).
4. Connect the YouTube account, choose a channel, and sync a closed date range (end date before today).
5. Check /dashboard/strategy and /dashboard/revenue; compare actual metrics against YouTube Studio.
6. Keep existing OAuth scopes; reconnect Google only if the required read permissions are missing.

The implementation does not require new secrets. It uses the existing YouTube OAuth connection and encrypted token storage.
