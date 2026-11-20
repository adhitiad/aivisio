# Project Baseline Rules

Berlaku untuk seluruh coding agent dan kontributor AIVISO.

## 1. Analisis sebelum implementasi

- Periksa struktur repository, implementasi sejenis, schema Prisma, route registration, UI, tests, dan dokumentasi terkait sebelum coding.
- Ikuti pola arsitektur yang sudah digunakan. Jangan memperkenalkan framework, database, queue, atau dependency baru hanya karena preferensi pribadi.
- Periksa versi dependency di lockfile dan package manifest; jangan menebak API berdasarkan dokumentasi versi lain.
- Buat perubahan sekecil mungkin dan jaga backward compatibility.

## 2. Database dan Prisma

- `docs/RULES.md` adalah aturan database utama.
- Setiap model baru wajib memiliki `createdAt` dan `updatedAt`.
- Tambahkan index untuk kolom yang dipakai pada filter, pencarian, relasi, atau sorting.
- Gunakan Prisma sebagai akses database utama. Raw query hanya jika benar-benar diperlukan dan aman.
- Periksa relasi, unique constraint, nullable semantics, cascade behavior, dan potensi data migration.
- Jangan menjalankan perubahan schema pada production tanpa backup, review migration plan, dan persetujuan pemilik.
- Setelah perubahan schema, jalankan Prisma generate dan tes yang relevan.

## 3. API dan keamanan

- Validasi input API menggunakan Zod.
- Endpoint privat wajib memakai mekanisme autentikasi/otorisasi yang sesuai, seperti `getApiSession()` atau `adminGate()`.
- Jangan mempercayai userId, role, ownership, status pembayaran, atau resource ID dari client tanpa verifikasi server.
- Terapkan ownership scoping pada query read/write.
- Jangan membocorkan token, secret, stack trace, internal error, atau data pribadi ke response/log.
- Ikuti kebijakan OAuth-only pada `docs/RULES.md`; jangan menambah password authentication.
- Pertahankan security headers dan rate limiting yang sudah ada.

## 4. UI dan kualitas produk

- Bahasa UI wajib tersedia dalam Bahasa Indonesia dan Inggris melalui i18next. Teks baru harus masuk ke kedua locale.
- Light dan dark theme wajib didukung melalui semantic tokens; hindari hardcoded color.
- Pertahankan pola loading, empty, error, success, dan unauthorized state.
- Gunakan komponen dan ikon yang sudah dipakai repository.
- Pastikan aksesibilitas dasar: label, keyboard interaction, focus state, dan pesan error yang jelas.

## 5. Testing dan dokumentasi

- Tambahkan/ubah unit atau integration tests untuk perilaku baru dan regression risk.
- Jalankan format/lint, typecheck, tests, Prisma generate, dan production build sesuai scripts repository.
- Jangan menyatakan tes lulus jika belum dijalankan atau hasil CI belum tersedia.
- Perbarui dokumentasi task/workflow/context bila status, kontrak, keputusan, atau prosedur operasional berubah.
- Pisahkan fakta terverifikasi, asumsi, dan pekerjaan yang belum dilakukan.
