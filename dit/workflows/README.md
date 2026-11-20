# Workflows

Folder ini menyimpan roadmap tingkat produk dan urutan implementasi workstream AIVISO.

## Roadmap utama

- [AIVISO Master Product & Engineering Roadmap](./AIVISO-MASTER-ROADMAP.md) — master phases PHASE 0 sampai PHASE 8. Ini adalah sumber utama urutan dan scope produk.
- [YouTube Publishing Reliability & Operations](./YOUTUBE-PUBLISHING-ROADMAP.md) — workstream teknis lintas fase dengan label historis P3.1–P3.9.

## Aturan penomoran

- **Master PHASE 0–PHASE 8** adalah fase utama produk. Master PHASE 3 berarti Market & Opportunity Engine.
- **Priority P0/P1/P2** adalah prioritas fitur, bukan fase.
- **YouTube Publishing P3.1–P3.9** adalah label submilestone workstream publishing lama. Selalu tulis konteks "YouTube Publishing" saat merujuknya; label tersebut tidak sama dengan Master PHASE 3.
- Task baru harus mencantumkan master phase dan workstream secara eksplisit agar tidak membuat nomor baru yang ambigu.

## Aturan pelaksanaan

Setiap milestone harus memiliki scope, dependency, acceptance criteria, validasi, risiko, dan status eksplisit.

Jangan:
- menganggap proposal sebagai implementasi;
- melompati dependency;
- menandai selesai hanya karena file sudah dibuat;
- menggabungkan task yang tidak terkait;
- memulai milestone berikutnya tanpa penugasan/persetujuan pemilik;
- menyamakan CI pass dengan production verification.
