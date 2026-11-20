# AIVISO — petunjuk untuk agen

Stack saat ini: **TanStack Start + React 19 + Vite 8**, autentikasi **BetterAuth**,
database **PostgreSQL** lewat **Prisma 7** (ID `uuid(7)`), i18n **i18next/react-i18next**,
UI shadcn/Tailwind 4,TanStack Query / Table / Form / DB / Store.

## Aturan penting
- Ikuti `docs/RULES.md` (skill DB, dead code, commit/push, keamanan, i18n, tema).
- Route ada di `src/routes/` (file-based TanStack Router). API route memakai
  `createFileRoute(...)({ server: { handlers: { GET/POST/... } } })`.
- Jangan import modul server (`@/lib/db`, `@/lib/auth`, `@/lib/session`, server
  functions) langsung dari komponen client — gunakan server function / loader.
- Session: `getSessionFn()` / `getApiSession()` dari BetterAuth. Proteksi halaman
  lewat `beforeLoad` di `src/routes/_protected.tsx`.
- Teks UI harus ditambahkan ke `messages/id.json` **dan** `messages/en.json`.
- Sebelum menghapus file/fungsi yang tampak tak terpakai, minta konfirmasi dulu.

## Perintah
- `bun run dev` — dev server (port 3000).
- `bun run build` — build produksi ke `dist/` + `.output/`.
- `bun run start` — jalankan `.output/server/index.mjs`.
- `bun run typecheck` / `bun run lint`.
- `bun run db:generate` & `bun run db:push` setelah mengubah `prisma/schema.prisma`.
- `bun run auth:generate` setelah mengubah plugin/config BetterAuth yang mengubah schema.
