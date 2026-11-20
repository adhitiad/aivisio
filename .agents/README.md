# Agent Operating Guide — AIVISO

Dokumen ini adalah pintu masuk bagi semua coding agent yang bekerja pada repository AIVISO.

## Urutan wajib sebelum bekerja

1. Baca `docs/RULES.md` — aturan proyek yang menjadi sumber utama.
2. Baca `.agents/rules/` — aturan operasional agent.
3. Baca `dit/context/PROJECT-STATE.md` dan `dit/context/AGENT-HANDOFF.md`.
4. Baca workflow dan task aktif di `dit/workflows/` serta `dit/tasks/`.
5. Baca skill yang relevan di `.agents/skills/` dan skill umum yang sudah ada di `skills/`.
6. Periksa kondisi Git, branch, commit, dan status CI terbaru sebelum mengubah file.

## Prioritas sumber kebenaran

Jika ada konflik, gunakan urutan berikut:

1. Instruksi eksplisit pemilik repository pada percakapan/task terbaru.
2. `docs/RULES.md`.
3. `.agents/rules/`.
4. Status kode dan schema aktual pada branch target.
5. `dit/context/`, workflow, task, dan dokumentasi historis.

Dokumentasi bisa tertinggal dari kode. Jangan menganggap dokumentasi sebagai bukti implementasi; verifikasi file, commit, dan CI.

## Scope agent

- Kerjakan hanya task yang sedang ditugaskan.
- Jangan mulai milestone berikutnya secara otomatis.
- Jangan mengubah scope atau kontrak API tanpa mencatat dampaknya.
- Jangan menghapus atau memindahkan file, folder, skill, scaffold, atau generated file tanpa persetujuan eksplisit.
- Jangan menimpa pekerjaan yang sudah ada. Lakukan minimal-diff.
- Laporkan file yang berubah, tes yang dijalankan, hasil CI, risiko, dan pekerjaan yang belum selesai.
