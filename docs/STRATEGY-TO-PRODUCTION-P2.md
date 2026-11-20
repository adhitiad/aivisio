# P2 — Strategy-to-Production Workflow

## Flow
1. A creator saves a niche profile and creates a content idea on /dashboard/strategy.
2. The user starts a video project directly from that idea.
3. The API verifies the idea belongs to the authenticated user's channel and rejects duplicate active production for the same idea.
4. The video project stores the idea relation and a bounded, sanitized copy of the immutable strategy snapshot.
5. The storyboard planner receives strategy data as editorial context while its system constraints and anti-hallucination rules remain authoritative.
6. The idea moves to producing, then produced on successful rendering or production_failed on an error.

## Design constraints
- Existing manual video creation remains backward-compatible; contentIdeaId is optional.
- The strategy snapshot is copied into the project, so later profile edits cannot rewrite in-flight prompts.
- Creator-provided strings are treated as descriptive data, not trusted system instructions.
- A completed render is not automatically a YouTube publication; the workflow does not mark the idea as published.
- The existing PostgreSQL + Redis queue and object-storage video worker remain the production path.

## Verification
Run db:generate, typecheck, lint, bun test, and production build. Apply Prisma schema changes after backing up PostgreSQL using the environment's established schema deployment procedure.
