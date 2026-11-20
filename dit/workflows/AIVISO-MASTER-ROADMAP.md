# AIVISO — Master Product & Engineering Roadmap

Dokumen ini adalah **roadmap induk produk AIVISO**. Seluruh pengembangan produk harus dipetakan ke fase utama **PHASE 0–PHASE 8** di bawah ini.

**Repository:** `adhitiad/aivisio`  
**Branch kerja:** `adhitiad_gpt`  
**Baseline sinkronisasi dokumentasi:** `08655899178ab98995f3ab86ba4545f89fc6b056`  
**Status roadmap:** fase-fase memiliki tingkat implementasi berbeda; lihat status dan bukti pada tabel, jangan menganggap semua fitur fase telah selesai.

> **Penting: penomoran berbeda memiliki fungsi berbeda.** Master PHASE 3 adalah Market & Opportunity Engine. Label lama `P3.1–P3.9` adalah submilestone workstream YouTube Publishing Reliability & Operations dan **bukan** anak dari Master PHASE 3. Prioritas P0/P1/P2 juga bukan nomor fase.

## 1. Master phases

| Master phase | Nama | Ruang lingkup utama | Status berdasarkan dokumentasi |
|---|---|---|---|
| PHASE 0 | Repository Audit & Foundation | Audit arsitektur, reusable modules, risiko security/multitenancy, media storage, durable queue, dependency map | Fondasi storage dan queue telah didokumentasikan; sign-off audit menyeluruh belum tercatat |
| PHASE 1 | Security & Account Ownership | RBAC OWNER/ADMIN/CREATOR, ownership, API authorization, Zod validation, OAuth credential protection, rate limiting, webhook security | Kontrol dasar dan dokumentasi keamanan tersedia; acceptance menyeluruh perlu diverifikasi |
| PHASE 2 | YouTube Intelligence Engine | Google OAuth, YouTube Data API v3, YouTube Analytics, channel/video sync, historical snapshots, authorized revenue metrics, SEA research | Integrasi dasar OAuth, Analytics, dan public market data terdokumentasi; kelengkapan seluruh scope belum terbukti |
| PHASE 3 | Market & Opportunity Engine | Niche demand, keyword/trend evidence, competition gap, competitor cadence, outlier, OpportunityScore, confidence dan evidence | Public market discovery serta Opportunity Score v1 tersedia; belum setara dengan seluruh target engine |
| PHASE 4 | Creator Revenue Intelligence | Actual revenue/RPM, historical analysis, forecasts, affiliate, sponsorship, memberships, product opportunities | Revenue Analytics dan scenario baseline terdokumentasi; sponsorship, affiliate, dan continuous forecasting masih perlu dituntaskan |
| PHASE 5 | Rights-Aware Video Production | Asset provenance/licensing, original scripts, fact-checking, storyboard, scene selection, subtitles, audio sync, FFmpeg, quality gates | Video pipeline dan durable worker tersedia; rights library saat ini berupa katalog/link metadata dan bukan clearance otomatis |
| PHASE 6 | AI Thumbnail Lab | Scene/focal-point selection, image enhancement, composition, title/thumbnail concepts, variants dan experiments | Thumbnail variant baseline terdokumentasi; seluruh target konsep/eksperimen belum diverifikasi |
| PHASE 7 | Post-Publish Feedback Loop | Sync performance, CTR/retention/revenue analysis, experiment outcomes, learning untuk niche, scripts, hooks dan thumbnails | Belum ada bukti dokumentasi bahwa closed-loop feedback lengkap sudah berjalan end-to-end |
| PHASE 8 | Engineering Quality | Durable jobs, workers, persistent media, retries, observability, migrations, tests, authorization tests, CI dan release validation | Fondasi CI, worker, tests dan observability tersedia; merupakan quality gate berkelanjutan |

Status pada tabel adalah penilaian dokumenter, bukan sertifikasi produksi. Untuk setiap klaim implementasi, periksa kode, test, CI, konfigurasi deployment, dan bukti staging/production yang relevan.

## 2. Detail ruang lingkup per fase

### PHASE 0 — Repository Audit & Foundation

Sebelum mengembangkan modul:
- Audit struktur repository, seluruh API routes, Prisma models, worker, pipeline, provider, dan UI yang relevan.
- Petakan dependency, reusable modules, unfinished behavior, security boundary, dan multitenancy boundary.
- Pertahankan framework, database, AI provider architecture, serta FFmpeg pipeline yang sudah berjalan kecuali ada alasan teknis terukur.
- Gunakan Neon Object Storage untuk media persisten dan Redis abstraction sebagai dispatch/wake-up queue; PostgreSQL tetap menjadi system of record untuk job state.
- Lakukan migrasi media dengan dry-run, backup, integrity verification, dan rollback plan.

Dokumen: `docs/INFRASTRUCTURE-P0.md`.

### PHASE 1 — Security & Account Ownership

- Role: OWNER, ADMIN, CREATOR.
- Privileged endpoint harus melakukan server-side authorization; jangan mempercayai role atau ownership dari browser.
- Terapkan ownership scoping untuk channel, video project, analytics, publishing, assets, dan resource creator lainnya.
- Validasi input API dengan Zod; terapkan rate limit untuk operasi mahal.
- Lindungi OAuth access/refresh token, provider credentials, webhook secrets, dan log.
- Pertahankan OAuth login policy serta security headers yang ditetapkan `docs/RULES.md`.

Dokumen: `docs/SECURITY-PHASE-1.md` dan `docs/RULES.md`.

### PHASE 2 — YouTube Intelligence Engine

- Hubungkan channel melalui consented Google OAuth.
- Gunakan YouTube Data API v3 dan YouTube Analytics API sesuai scope yang diberikan.
- Sinkronkan channel, video, public statistics, dan private analytics milik user.
- Simpan historical snapshots dengan data provenance, observation period, freshness, quota guard, caching, retry/backoff, dan graceful degradation.
- Regional research mencakup ID, MY, SG, PH, TH, VN, BN, KH, LA, dan MM.
- Jangan menyebut public search result sebagai keyword search volume. Jangan membuat data views, retention, impressions, CTR, atau revenue yang tidak tersedia dari sumber resmi.

Dokumen: `docs/YOUTUBE-OAUTH-ANALYTICS.md` dan `docs/YOUTUBE-MARKET-RESEARCH.md`.

### PHASE 3 — Market & Opportunity Engine

- Analisis demand signals, market trend, niche, competition density, competitor upload frequency, video velocity, content gap, audience fit, production feasibility, dan monetization fit.
- OpportunityScore bernilai 0–100 harus explainable: simpan komponen, evidence, source, observation period, confidence, serta alasan rekomendasi.
- Pisahkan high demand, high competition, low competition, breakout, evergreen, dan seasonal opportunity.
- Rekomendasi harus berdasarkan data/evidence yang tersedia; generic LLM knowledge bukan bukti demand.
- Public API ranking, relative velocity, dan lifetime views/day tidak boleh dipasarkan sebagai search volume atau prediksi keberhasilan.

Dokumen: `docs/YOUTUBE-MARKET-RESEARCH.md` dan `docs/CREATOR-INTELLIGENCE.md`.

### PHASE 4 — Creator Revenue Intelligence

- Gunakan data Analytics milik creator yang telah memberikan izin.
- Pisahkan actual estimated revenue/RPM dari asumsi dan what-if scenario.
- Forecast harus menampilkan asumsi serta rentang/sensitivity; jangan menjanjikan income.
- Lanjutkan affiliate/product, sponsorship/brand-deal matching, membership, dan revenue tracking sesuai bukti data dan consent.
- Monetary metrics yang tidak tersedia harus ditampilkan unavailable, bukan dibuat menjadi nol.

Dokumen: `docs/YOUTUBE-P1-ENGINES.md` dan `docs/CREATOR-INTELLIGENCE.md`.

### PHASE 5 — Rights-Aware Video Production

- Dukung original footage, licensed stock, authorized creator contributions, commercially usable Creative Commons, public-domain, AI-generated media, animation, charts, music, dan sound effects.
- Simpan provenance, owner/source, license, commercial-use permission, attribution, evidence, restrictions, dan expiry.
- Jangan mengunduh atau mendistribusikan ulang video kompetitor tanpa hak.
- Bangun original scripts dari beberapa sumber yang diverifikasi; sertakan citations, claim validation, contradiction detection, storyboard, narrative consistency, subtitles, audio sync, FFmpeg assembly, dan quality validation.
- Jangan memberi status production-ready pada output placeholder-heavy atau asset yang belum lolos validasi hak/kualitas.

Dokumen: `docs/CREATOR-INTELLIGENCE.md`, `docs/VIDEO-WORKER.md`, dan `docs/INFRASTRUCTURE-P0.md`.

### PHASE 6 — AI Thumbnail Lab

- Gunakan project, storyboard, script, selected frames, brand identity, audience, niche, language, dan title sebagai input.
- Implementasikan scene/focal detection, image enhancement/editing, composition, focal point, text placement, contrast, dan brand consistency.
- Target tiga konsep berbeda, masing-masing dengan image, title suggestion, visual hook, rationale, dan version ID.
- Thumbnail/title harus konsisten dengan konten aktual dan tidak menyalin thumbnail kompetitor.
- Experiment/export tidak boleh diklaim aktif sebelum integrasi dan hasilnya diverifikasi.

Dokumen: `docs/CREATOR-INTELLIGENCE.md`.

### PHASE 7 — Post-Publish Feedback Loop

- Sinkronkan performa channel/video setelah publikasi.
- Analisis CTR, retention, watch time, audience, experiment results, dan revenue hanya bila metrik benar-benar tersedia.
- Hubungkan hasil aktual dengan niche ranking, topic recommendations, scripts, hooks, thumbnails, serta publishing strategy.
- Simpan lineage input/output dan hindari continual learning yang tidak terukur atau data leakage antar creator.
- Perubahan model/rekomendasi harus dievaluasi sebelum memengaruhi keputusan pengguna.

Status: rancang task khusus setelah data dan experiment contracts siap; jangan mengasumsikan fitur ini sudah selesai.

### PHASE 8 — Engineering Quality

- Durable background jobs, separate workers, persistent media, progress, bounded retries, recovery, structured logs, dan observability.
- Database schema/index review, backup, migration/deployment dan rollback plan.
- Unit, integration, authorization, ownership, worker, API dan video pipeline tests.
- Typecheck, lint, Prisma generate, test suite, production build, CI, dependency/security checks.
- UI bilingual Indonesia/Inggris melalui i18next serta light/dark semantic theme.
- CI success bukan bukti schema production sudah diterapkan atau layanan eksternal sudah live.

## 3. Priority backlog — bukan master phase

Prioritas berikut adalah urutan/kelas prioritas fitur dari product brief. Item dapat mendukung beberapa master phase dan statusnya harus dicek pada task serta kode.

| Priority | Item |
|---|---|
| **Priority P0** | Neon Object Storage + migrasi seluruh media |
| **Priority P0** | Redis abstraction: Local, Upstash, Redis Cloud |
| **Priority P1** | Niche Profile & Strategy Engine |
| **Priority P1** | Revenue Optimization Engine |
| **Priority P1** | Niche Commercial Intelligence |
| **Priority P1** | Competitor & Topic Opportunity Engine |
| **Priority P1** | Retention Engineering |
| **Priority P1** | Hybrid Video Editing & Rights Validation |
| **Priority P1** | Thumbnail & Title Experiment Engine |
| **Priority P1** | Affiliate & Product Revenue Engine |
| **Priority P2** | Sponsorship & Brand Deal Intelligence |
| **Priority P2** | Revenue Forecasting dan Continuous Learning |

Priority P0/P1/P2 menunjukkan prioritas fitur, bukan fase yang harus memiliki nomor subtask sama dengan Master PHASE 0/1/2.

## 4. Cross-cutting workstreams

Workstream dapat melintasi beberapa master phase. Setiap roadmap workstream harus menjelaskan relasi ini.

- **YouTube Publishing Reliability & Operations:** upload foundation, resumable upload, scheduler, preflight, observability, operations dashboard, execution history, alert lifecycle, dan guarded recovery.
- **Engineering/security:** berlaku pada semua fase, bukan pekerjaan satu fase saja.
- **Data & AI quality:** provenance, confidence, ownership, auditability, dan anti-fabrication berlaku pada semua mesin rekomendasi.

Roadmap YouTube Publishing yang memiliki label historis P3.1–P3.9 berada di `YOUTUBE-PUBLISHING-ROADMAP.md`. Label tersebut tidak mengubah Master PHASE 3 yang merupakan Market & Opportunity Engine.

## 5. Milestone exit criteria

Fase atau submilestone hanya boleh dinyatakan done bila:
1. Scope, non-goals, dan acceptance criteria terpenuhi.
2. Implementasi berada di branch yang ditetapkan dan tidak menimpa perubahan lain.
3. Typecheck, lint, tests, Prisma generation (bila relevan), serta production build lulus.
4. Security, ownership, privacy, idempotency, failure mode, dan regression risks telah diperiksa.
5. Dokumentasi task/workflow/context dan agent handoff diperbarui.
6. Bukti CI, staging, dan production dicatat terpisah.
7. Deployment, migration, live OAuth/API, media processing, dan notification delivery tidak diklaim terverifikasi tanpa bukti operasional.

## 6. Cara menggunakan roadmap

1. Mulai dengan `dit/README.md`, `docs/RULES.md`, dan `.agents/README.md`.
2. Pilih master phase yang ditugaskan dan baca dokumen domainnya.
3. Buat task terukur di `dit/tasks/` dengan dependency, acceptance criteria, risk, test plan, rollout, dan rollback.
4. Sebelum coding, fetch branch terbaru dan periksa HEAD/CI.
5. Kerjakan minimal diff; pertahankan file, scaffold, generated code, dan skill yang tidak terkait.
6. Minta persetujuan untuk keputusan terbuka serta tindakan Git/production sesuai rules repository.
7. Perbarui status hanya berdasarkan bukti yang bisa diverifikasi.
