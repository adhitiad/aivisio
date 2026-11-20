# Aturan Operasional Agent — AIVISO

## Wajib — Batas baris kode

- Kode wajib **< 395 baris** per file.
- Jika kamu mengatakan "haus" (butuh) lebih dari itu, diizinkan **hanya dengan alasan yang jelas dan masuk akal** (mis. generated code, file konfigurasi, data statis, atau file yang memang tidak bisa dipecah tanpa merusak struktur). Alasan wajib dicantumkan di komentar/PR.

## Wajib — Perintah yang harus dijalankan

Sebelum menyelesaikan task, wajib hukumnya menjalankan (dan lulus) perintah berikut:

- `vitest`
- `bunx tsc --noEmit`
- `test:e2e`
- `lint`
- `build`
