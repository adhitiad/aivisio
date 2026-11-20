# YouTube SEA market discovery

## Setup

1. Create a Google Cloud project.
2. Enable **YouTube Data API v3**.
3. Create a server-side API key.
4. Restrict the key to YouTube Data API v3 and, where supported, the production server's outbound IP addresses.
5. Set \`YOUTUBE_DATA_API_KEY\` in the deployment environment. Never expose it to browser code or commit a real key.

## API

Authenticated creators can call:

\`\`\`http
POST /api/youtube/market/search
Content-Type: application/json
\`\`\`

Example request:

\`\`\`json
{
  "query": "budget smartphone review",
  "market": "ID",
  "order": "relevance",
  "periodDays": 90,
  "maxResults": 50
}
\`\`\`

Supported markets: ID, MY, SG, PH, TH, VN, BN, KH, LA, MM.

Supported order values: relevance, date, viewCount.

Supported observation windows: 7, 30, 90, 365 days.

## Data meaning and limitations

- The API uses \`search.list\` with \`regionCode\` and \`relevanceLanguage\`, then enriches returned videos using \`videos.list\` and \`channels.list\`.
- The result represents videos returned by YouTube's relevance/ranking system. It is not a numeric keyword search-volume report.
- Views, likes, comments, publish date, duration, channel title, and public subscriber counts are public statistics observed at fetch time.
- A relative velocity index compares views-per-day across the current result sample. It is not a universal virality score and does not mean the system knows impressions, CTR, watch time, retention, or revenue.
- Hidden subscriber counts are represented as null.
- The service caches query results for six hours. The cache is shared because the underlying market data is public.
- Search queries and general Data API units have separate conservative internal guards. The daily date follows America/Los_Angeles (Pacific Time), consistent with YouTube API quota reset conventions.
- Internal guards are safety buffers, not a replacement for monitoring the actual Google Cloud quota dashboard.

## Production security

- Keep the key server-side.
- Apply API-key restrictions in Google Cloud.
- Use a separate key for development and production.
- Rotate compromised keys immediately.
- Monitor API quota, HTTP 403 responses, and rate-limit errors.

## Not yet included

This public market endpoint does not connect a creator's private channel analytics or revenue. Those require a separate, user-consented OAuth integration with the appropriate YouTube Analytics scopes and token lifecycle management.
