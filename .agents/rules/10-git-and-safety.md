# Git, Branch, and Change Safety

## Branch policy

- Branch kerja yang ditetapkan pemilik untuk pekerjaan saat ini: `adhitiad_gpt`.
- Jangan commit, push, merge, rebase, atau cherry-pick ke `main` tanpa instruksi eksplisit.
- Jangan force-push.
- Sebelum menulis: fetch/read branch terbaru dan catat HEAD SHA.
- Saat update ref, gunakan expected SHA / optimistic concurrency. Jika HEAD berubah, berhenti, fetch ulang, lalu rekonsiliasi.
- Jangan mengasumsikan branch lokal/remote sinkron tanpa memeriksanya.

## Commit dan push

- Dilarang commit atau push tanpa perintah eksplisit pemilik, sesuai `docs/RULES.md`.
- Persetujuan commit dan push harus dianggap terpisah kecuali pemilik secara jelas menyetujui keduanya.
- Gunakan conventional commit yang ringkas dan sesuai scope. Jangan menyebut nama model/agen AI pada pesan commit.
- Setelah push, verifikasi remote branch HEAD sama dengan commit yang dimaksud.
- Laporkan commit SHA, branch, URL commit, status push, dan status CI.
- Jangan membuat checkpoint kosong kecuali memang diminta.

## File safety

- Jangan menghapus, memindahkan, mengganti nama, atau merombak file/folder/skill/scaffold/generated files tanpa persetujuan eksplisit.
- Jangan membuat direktori duplikat hanya untuk menyamakan nama. Pertahankan `skills/` yang sudah ada.
- `skils/` adalah nama berbeda/kemungkinan typo; jangan membuat, menghapus, atau memindahkannya kecuali pemilik meminta secara eksplisit.
- Jangan menimpa file yang tidak terkait. Gunakan minimal-diff.
- Jangan memasukkan file hasil build, cache, credential, atau file lokal yang tidak diperlukan.

## Secret and production safety

- Jangan pernah meminta atau menuliskan OAuth tokens, refresh tokens, client secrets, cookies, API keys, webhook secrets, atau cron secrets ke chat, commit, atau log.
- Jangan membuka/mengubah production data atau menjalankan migration production tanpa izin eksplisit dan prosedur backup.
- Jangan melakukan live YouTube upload atau perubahan channel tanpa persetujuan eksplisit, video/channel yang ditentukan, dan pemeriksaan preflight.
- Jangan mengklaim deploy, upload live, atau verifikasi production jika tidak ada bukti.
