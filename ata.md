
You are acting as a Principal Software Architect, Senior
TypeScript Engineer, AI Video Production Engineer, and
YouTube Growth Intelligence Engineer.

PROJECT:
https://github.com/adhitiad/aivisio

MISSION:
Transform AIVISIO into an AI Creator Growth & Revenue Studio
specialized in YouTube creators across Southeast Asia.

CORE OBJECTIVE:
The application must help creators discover profitable
content opportunities, research their niche, create
original high-retention videos, optimize thumbnails,
and increase their actual channel revenue.

IMPORTANT:
This is NOT primarily a UI/UX redesign project.

Prioritize:
1. Functional business logic.
2. Data acquisition and accuracy.
3. YouTube API integrations.
4. AI recommendation intelligence.
5. Video production pipeline.
6. Thumbnail optimization.
7. Revenue intelligence.
8. Security and reliability.

==================================================
PHASE 0 — REPOSITORY AUDIT
==================================================

Before implementing anything:

- Read AGENTS.md and docs/RULES.md.
- Analyze the complete existing architecture.
- Inspect every existing API route and database model.
- Identify reusable implementations.
- Identify dead or unfinished functionality.
- Identify security and multitenancy issues.
- Create a dependency map.
- Preserve working functionality.

DO NOT:
- Replace the existing framework without justification.
- Rewrite working modules unnecessarily.
- Remove existing files without authorization.
- Commit or push without explicit instruction.
- fabricate API results, analytics, search volume or revenue.

PRESERVE:
- TanStack Start
- React 19
- TypeScript
- Bun
- PostgreSQL
- Prisma 7
- BetterAuth
- Existing AI provider architecture
- Existing FFmpeg pipeline

==================================================
PHASE 1 — SECURITY & ACCOUNT OWNERSHIP
==================================================

Implement proper RBAC:

OWNER
ADMIN
CREATOR

Requirements:
- Protect all administrative endpoints.
- Protect global settings.
- Protect contact messages.
- Enforce ownership on all channel and video projects.
- Prevent cross-user data access.
- Validate all API payloads with Zod.
- Add rate limiting to expensive AI endpoints.
- Secure OAuth credentials and refresh tokens.
- Validate webhook signatures where applicable.

Fix the existing authorization weaknesses.

ADMIN_API_GATE must not be treated as
a substitute for role-based authorization.

==================================================
PHASE 2 — YOUTUBE INTELLIGENCE ENGINE
==================================================

Implement genuine YouTube channel integration.

Support:
- Google OAuth channel connection.
- YouTube Data API v3.
- YouTube Analytics API.
- Channel synchronization.
- Video synchronization.
- Historical performance snapshots.
- Revenue metrics where authorized.

Required OAuth scopes:
- youtube.readonly
- yt-analytics.readonly
- yt-analytics-monetary.readonly

Support regional research:

ID, MY, SG, PH, TH, VN, BN, KH, LA, MM.

Implement:
- regionCode-based discovery.
- relevanceLanguage.
- public video statistics.
- upload date.
- views.
- likes.
- comments.
- video duration.
- category.
- channel statistics.
- historical view velocity.

Use official APIs.

Do not scrape YouTube HTML as the primary
source of market intelligence.

Implement:
- Request caching.
- Quota monitoring.
- Backoff.
- Retry policies.
- Data provenance.
- Data freshness.
- Graceful degradation.

Use YouTube Studio Research and Trends information
as an optional creator-supplied research source.

Implement Google Trends integration only through
available authorized interfaces.

IMPORTANT:
Public API search results are NOT equivalent
to real search volume.

Never fabricate search volume.

==================================================
PHASE 3 — MARKET & OPPORTUNITY ENGINE
==================================================

Create a dedicated market intelligence service.

Analyze:
- Niche demand.
- Trending keywords.
- Demand growth.
- Seasonal interest.
- Competition density.
- Competitor upload frequency.
- Video performance velocity.
- Outlier videos.
- Audience relevance.
- Production feasibility.
- Monetization opportunities.

Create OpportunityScore (0-100).

Score must incorporate:
- Demand growth.
- Competition gap.
- Audience match.
- Content gap.
- Revenue fit.
- Creator production capacity.

Recommendations must include:
- Country.
- Language.
- Niche.
- Keyword.
- Supporting evidence.
- Data source.
- Observation period.
- Confidence score.
- Reason for recommendation.

Separate:
HIGH DEMAND
HIGH COMPETITION
LOW COMPETITION
BREAKOUT OPPORTUNITY
EVERGREEN OPPORTUNITY
SEASONAL OPPORTUNITY

Generate ranked video ideas for each channel.

Never recommend a niche based only on generic
LLM knowledge.

==================================================
PHASE 4 — CREATOR REVENUE INTELLIGENCE
==================================================

Connect YouTube Analytics data.

Analyze:
- Views.
- Watch time.
- Average view duration.
- Average view percentage.
- Thumbnail impressions.
- CTR.
- Subscribers gained.
- Audience countries.
- Estimated revenue.
- RPM.
- CPM where available.

Implement revenue planning:

- Historical revenue analysis.
- Revenue per 1,000 views.
- Revenue projections with confidence ranges.
- Affiliate opportunities.
- Sponsorship matching.
- Product recommendations.
- Membership opportunities.
- Revenue tracking.

Use the creator's own historical revenue
when calculating projections.

Do not promise guaranteed income.

==================================================
PHASE 5 — RIGHTS-AWARE VIDEO PRODUCTION
==================================================

Extend the current video pipeline.

Support multimodal assets:

- Original creator footage.
- Licensed stock footage.
- Authorized creator contributions.
- Commercially usable Creative Commons assets.
- Public-domain assets.
- AI-generated images.
- AI-generated video.
- Animations.
- Charts and infographics.
- Music and sound effects.

Implement asset provenance and licensing metadata.

Every imported asset must record:
- Source.
- Owner.
- License.
- Commercial use permission.
- Attribution requirements.
- Permission evidence.
- Usage restrictions.
- Expiry date.

Do not implement unauthorized downloading
or redistribution of competitor videos.

Competitor videos should primarily be used
for analysis and research.

Generate original scripts incorporating
multiple independently verified sources.

Implement:
- Fact checking.
- Source citations.
- Claim validation.
- Contradiction detection.
- Storyboard generation.
- Original commentary.
- Narrative consistency.
- Scene selection.
- Automatic subtitles.
- Audio synchronization.
- FFmpeg assembly.
- Quality validation.

Improve video retention through:
- Opening hooks.
- Narrative progression.
- Dynamic visual changes.
- Scene pacing.
- Appropriate audio.
- Visual continuity.
- Meaningful storytelling.
- Satisfying conclusions.

Do not mark placeholder-heavy output as
production-ready without quality checks.

==================================================
PHASE 6 — AI THUMBNAIL LAB
==================================================

Build a dedicated thumbnail generation engine.

Inputs:
- Video project.
- Storyboard.
- Script.
- Selected video frames.
- Channel brand identity.
- Target audience.
- Niche.
- Language.
- Video title.

Implement:
- Important scene detection.
- Main subject detection.
- Focal point selection.
- AI image editing.
- Image enhancement.
- Composition improvement.
- Text placement.
- Contrast optimization.
- Visual consistency.

Generate three distinct concepts.

Each concept must include:
- Image.
- Title suggestion.
- Visual hook.
- Audience motivation.
- Rationale.
- Version ID.

Do not copy competitor thumbnails directly.

Maintain consistency between thumbnail,
title, and actual video content.

Support exporting variants for YouTube's
native thumbnail/title experiments.

==================================================
PHASE 7 — POST-PUBLISH FEEDBACK LOOP
==================================================

Implement:
- Channel performance synchronization.
- Video performance synchronization.
- Thumbnail experiment records.
- Historical CTR comparison.
- Retention analysis.
- Revenue contribution.
- Topic performance comparison.

After each published video:

Analyze what worked and what failed.

Feed the results back into:
- Niche ranking.
- Future topic recommendations.
- Script generation.
- Hook generation.
- Thumbnail generation.
- Publishing strategy.

The recommendation system must improve
using actual creator performance data.

==================================================
PHASE 8 — ENGINEERING QUALITY
==================================================

Implement:
- Durable background jobs.
- Separate video workers.
- Persistent media storage.
- Job progress tracking.
- Retry and failure recovery.
- Structured logging.
- Observability.
- Database migrations.
- Unit tests.
- Integration tests.
- API authorization tests.
- Video pipeline tests.
- CI validation.

Add:
- Type checking.
- ESLint.
- Production build verification.
- Database migration verification.

Update messages/id.json and messages/en.json
for all new user-facing text.

Follow all existing repository rules.

==================================================
FINAL ACCEPTANCE CRITERIA
==================================================

AIVISIO is not considered complete merely
because its screens or prompts work.

Verify that:

1. A creator can connect their YouTube channel.
2. The system can collect authorized channel analytics.
3. Market discovery works by SEA country.
4. Recommendations contain verifiable evidence.
5. Opportunity scores have explainable inputs.
6. Revenue estimates are based on real data
   or explicitly labelled assumptions.
7. Videos combine original and legally usable assets.
8. Every external asset has provenance.
9. The thumbnail engine creates three variants.
10. Production jobs survive application restarts.
11. Users cannot access other creators' data.
12. Automated tests validate critical workflows.

WORKING METHOD:

Implement in independently testable phases.

For each phase:
- Inspect existing code.
- Design the changes.
- Implement backend functionality.
- Update Prisma schema and migrations.
- Add tests.
- Run typecheck.
- Run lint.
- Run relevant integration tests.
- Report completed files.
- Report unresolved risks.

Do not claim completion based on UI mockups,
placeholder responses, or unimplemented prompts.

The final product must be a functioning
YouTube Creator Growth & Revenue Studio.
