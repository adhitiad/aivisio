# Agent Handoff — Read Before Coding

## What are we building?

AIVISO is an AI Creator Growth & Revenue Studio for YouTube creators across Southeast Asia. The product master roadmap runs from **Master PHASE 0 through Master PHASE 8**.

The current repository also contains a separate YouTube Publishing Reliability & Operations workstream. Its historical labels P3.1–P3.9 are not the same as Master PHASE 3.

## Mandatory reading order

1. Read `docs/RULES.md`.
2. Read `.agents/README.md` and all applicable `.agents/rules/*.md`.
3. Read `dit/README.md` and `dit/context/ROADMAP-NUMBERING.md`.
4. Read `dit/workflows/AIVISO-MASTER-ROADMAP.md`.
5. Read `dit/context/PROJECT-STATE.md`.
6. Read the specific domain workflow and assigned task.
7. Inspect current code, tests, and latest CI on the latest `adhitiad_gpt` HEAD.

## Roadmap boundaries

- Master product scope: PHASE 0–PHASE 8.
- Feature priority classes: Priority P0/P1/P2.
- YouTube Publishing legacy workstream: Publishing P3.1–P3.9.
- Never refer to Publishing P3.9 as the last phase of AIVISO.
- Master PHASE 3 means Market & Opportunity Engine, not YouTube Publishing.
- The candidate Publishing P3.9 task is proposed and not started. Do not start it without owner approval and resolution of open decisions.
- Do not restart Publishing P3.1–P3.8 or rewrite existing working features without a concrete defect.

## Current next-agent behavior

1. Confirm the owner-assigned master phase/workstream.
2. Read its roadmap/task and inspect implementation before coding.
3. Map existing behavior, ownership boundaries, database schema, route registration, UI, tests, and failure modes.
4. Produce a minimal-diff plan with migration, security, test, rollback, and documentation impact.
5. Ask for approval when task scope, provider, production action, or task open decisions require owner input.
6. Implement only the assigned scope; do not automatically advance to the next milestone.
7. Run the applicable checks and report exact evidence.

## What must not happen?

- Do not treat a roadmap proposal as authorization to begin.
- Do not claim production deployment, production migration, live YouTube upload, external monitor, or end-to-end notification delivery has been verified without evidence.
- Do not send ambiguous upload retry without checking YouTube Studio/session reconciliation.
- Do not change `main`, force-push, or bypass explicit commit/push permission.
- Do not delete or reorganize existing `skills/`, docs, generated files, or scaffolding.
- Do not create `skils/` as a duplicate of `skills/`.
- Do not fabricate search volume, analytics, audience retention, CTR, views, or revenue.

## Branch and workflow

Use `adhitiad_gpt` as the working branch unless the owner changes this instruction. Fetch latest branch first. Make minimal diffs, run tests, and report exact evidence. Ask before commit/push unless the owner explicitly authorizes those actions.

## Reporting template

At task completion, report:
- Master phase and workstream/task ID.
- Scope completed / not completed.
- Files changed.
- Schema/API changes and migration impact.
- Tests actually run and results.
- CI URL and commit SHA if available.
- Security/operational risks.
- Production steps still outstanding.
- Next recommended task, without starting it automatically.
