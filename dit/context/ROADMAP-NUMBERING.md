# AIVISO Roadmap Numbering & Naming Rules

Dokumen ini mencegah konflik interpretasi antara master product phases, feature priorities, dan workstream milestone.

## 1. Master product phases

Sumber kebenaran: [AIVISO Master Roadmap](../workflows/AIVISO-MASTER-ROADMAP.md).

Gunakan label `Master PHASE 0` sampai `Master PHASE 8`. Contoh:
- `Master PHASE 3 — Market & Opportunity Engine`
- `Master PHASE 5 — Rights-Aware Video Production`

Selalu tulis kata **Master PHASE** saat konteks dapat menimbulkan ambiguitas.

## 2. Feature priorities

Gunakan `Priority P0`, `Priority P1`, atau `Priority P2` untuk menunjukkan prioritas fitur/backlog.

Prioritas tidak berarti fase selesai, tidak mengubah urutan master phase, dan tidak menjadi namespace subtask otomatis. Satu fitur prioritas dapat mendukung lebih dari satu master phase.

## 3. YouTube Publishing workstream

Roadmap YouTube Publishing memiliki label historis `P3.1` sampai `P3.9`. Label itu berasal dari workstream Publishing Reliability & Operations, bukan Master PHASE 3.

Penulisan yang wajib:
- Benar: `YouTube Publishing P3.9`
- Benar: `Publishing workstream P3.8`
- Hindari: `P3.9 selesai` tanpa konteks workstream.

Master PHASE 3 tetap Market & Opportunity Engine. YouTube Publishing melintasi master phases karena mencakup integrasi YouTube, publikasi aset produksi, dan reliability engineering.

## 4. Task naming untuk pekerjaan baru

Setiap task baru harus menyebutkan:
- master phase terkait (atau `cross-cutting`);
- workstream/domain;
- unique task ID yang tidak berbenturan dengan master phase;
- dependency dan acceptance criteria.

Gunakan format judul deskriptif seperti:
`[Master PHASE 5] Rights-aware asset validation` atau
`[YouTube Publishing] Alert escalation & webhook delivery`.

Jangan membuat prefix `P3.x` baru untuk task yang bukan bagian dari legacy YouTube Publishing roadmap tanpa lebih dulu memperbarui master roadmap dan aturan ini.

## 5. Konflik dokumentasi

Urutan prioritas:
1. Instruksi eksplisit pemilik repository yang terbaru.
2. `docs/RULES.md`.
3. `.agents/rules/`.
4. Master roadmap dan task yang sudah disetujui.
5. Project-state dan handoff.
6. Dokumentasi historis.

Jika dua dokumen berbeda nomor/fokus, jangan menebak; tentukan namespace eksplisit dan update indeks terkait.
