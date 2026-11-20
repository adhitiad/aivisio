# Agent Handoff — Read Before Coding

## What are we building?

AIVISO repository. Current tracked work in this handoff is YouTube Publishing reliability and operations. Latest completed milestone is P3.8.

## What should the next agent do?

1. Read `docs/RULES.md`.
2. Read `.agents/README.md` and all applicable `.agents/rules/*.md`.
3. Read `dit/context/PROJECT-STATE.md`.
4. Read `dit/workflows/YOUTUBE-PUBLISHING-ROADMAP.md`.
5. Read `dit/tasks/P3.9-NEXT.md`.
6. Inspect current code and tests on latest `adhitiad_gpt` HEAD.
7. Report findings and ask for approval/open decisions before starting P3.9.

## What must not happen?

- Do not restart P3.1–P3.8 or rewrite existing working features without a concrete defect.
- Do not treat P3.9 proposal as an instruction to begin.
- Do not claim P3.5 live upload, production deployment, production migration, external monitor, or end-to-end notification delivery has been verified.
- Do not send ambiguous upload retry without checking YouTube Studio/session reconciliation.
- Do not change `main`, force-push, or bypass explicit commit/push permission.
- Do not delete or reorganize existing `skills/`, docs, generated files, or scaffolding.
- Do not create `skils/` as a duplicate of `skills/`.

## Branch and workflow

Use `adhitiad_gpt` as the working branch unless the owner changes this instruction. Fetch latest branch first. Make minimal diffs, run tests, and report exact evidence. Ask before commit/push unless the owner explicitly authorizes those actions.

## Reporting template

At task completion, report:
- Scope completed / not completed.
- Files changed.
- Schema/API changes and migration impact.
- Tests actually run and results.
- CI URL and commit SHA if available.
- Security/operational risks.
- Production steps still outstanding.
- Next recommended task, without starting it automatically.
