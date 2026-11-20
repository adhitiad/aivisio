# DIT — Development, Implementation & Task Handoff

Folder `dit/` adalah pusat roadmap, workflow engineering, task, dan handoff agent AIVISO.

## Struktur

- `workflows/`: master roadmap, urutan fase, dependency, dan workstream.
- `tasks/`: task aktif/berikutnya dengan scope, acceptance criteria, risiko, dan test plan.
- `context/`: kondisi repository, keputusan penomoran, status proyek, dan handoff agent.

## Dokumen utama

1. [AIVISO Master Product & Engineering Roadmap](./workflows/AIVISO-MASTER-ROADMAP.md) — sumber utama fase produk PHASE 0–PHASE 8.
2. [Roadmap Numbering & Naming](./context/ROADMAP-NUMBERING.md) — aturan membedakan master phase, feature priority, dan workstream milestone.
3. [YouTube Publishing Workstream](./workflows/YOUTUBE-PUBLISHING-ROADMAP.md) — roadmap teknis publishing dengan label historis P3.1–P3.9.
4. [Project State](./context/PROJECT-STATE.md) dan [Agent Handoff](./context/AGENT-HANDOFF.md) — snapshot kondisi terakhir dan instruksi agent.

## Cara agent memulai

1. Baca `../docs/RULES.md` dan `../.agents/README.md`.
2. Baca master roadmap dan aturan penomoran.
3. Baca `context/PROJECT-STATE.md` dan `context/AGENT-HANDOFF.md`.
4. Baca workflow dan task yang ditugaskan.
5. Verifikasi semua status terhadap branch, kode, tests, dan CI terbaru sebelum bertindak.

Dokumen ini tidak menggantikan kode, tests, Git history, atau hasil CI sebagai bukti.
