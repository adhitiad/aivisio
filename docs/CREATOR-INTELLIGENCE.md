# Creator Intelligence Modules

## Revenue Intelligence
Revenue Intelligence reads daily private YouTube Analytics rows. It requires a connected YouTube OAuth account with the monetary read scope. It reports estimated revenue, estimated ad revenue, views, RPM, ad RPM and a comparison with the previous date range of equal duration. RPM is estimated revenue per 1,000 views; it is not CPM or a settled creator payout. Historical values depend on Analytics sync and YouTube's availability of daily reports.

## Rights-aware Footage Library
The library stores links and rights metadata: source, license category, commercial-use claim, modification permission, attribution requirement, evidence URL and review state. New items are pending. Only OWNER/ADMIN can approve or reject; approval requires a non-unknown license and evidence URL. The approval workflow is an internal review control, not legal advice or automatic copyright clearance. This release catalogs HTTPS links only; it does not download or re-host footage.

## AI Thumbnail Lab
The lab generates 16:9 PNG variants for completed video projects, stores each version with its prompt and selection state, and allows preview, selection and deletion. Selecting a variant does not automatically upload or change a YouTube thumbnail. Image files use the same persistent media volume as video outputs.

## Opportunity Scoring Engine
The existing deterministic v1 score remains the baseline. It uses public observed momentum, lifetime views/day, public engagement, reach relative to channel subscribers and freshness, with available-component weight renormalization and a confidence label. It is a research-priority heuristic, not a prediction of virality, views or revenue.
