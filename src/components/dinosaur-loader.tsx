"use client";

import { useT } from "@/lib/i18n";

/**
 * Loading global — dinosaurus berjalan.
 * Dipakai oleh app/loading.tsx (dan bisa dipakai di Suspense fallback lain).
 */
export function DinosaurLoader() {
  const t = useT("errors");

  return (
    <div
      className="relative flex min-h-[60vh] w-full flex-col items-center justify-center overflow-hidden py-16"
      role="status"
      aria-live="polite"
    >
      {/* rel tanah */}
      <div className="pointer-events-none absolute bottom-24 left-0 right-0 border-t border-dashed border-border" />

      <div className="dino-cross">
        <div className="dino-bob text-foreground">
          <svg
            viewBox="0 0 150 96"
            className="h-28 w-44"
            fill="currentColor"
            aria-hidden="true"
          >
            {/* ekor panjang mencuat */}
            <g className="dino-tail">
              <path d="M6 64 C22 56 34 50 48 44 L50 55 C36 60 22 66 8 70 Z" />
            </g>
            {/* badan kekar + kepala besar khas T-rex */}
            <path d="M44 46 C42 30 52 21 66 20 L96 18 C101 18 105 14 107.5 9 C109 6.2 113.4 5.6 116 8.4 L138 30 C141 33 140.4 38.4 136 39.8 L126 43 C120 45.4 117 51 117 57 L117 60 C117 72 107 78 92 78 L64 78 C50 78 46 62 44 46 Z" />
            {/* rahang bawah */}
            <path d="M107 40 L136 40 C138 44 136 48 131 49 L112 50 C107 47 105 44 107 40 Z" />
            {/* mata */}
            <circle cx="119" cy="19.5" r="2.4" fill="var(--background)" />
            {/* lengan kecil dua jari */}
            <g className="dino-arm">
              <path d="M90 52 L99 55 L100 59 L97 59 L96 63 L92 63 L91 58 L84 55 Z" />
            </g>
            {/* kaki belakang (jauh) */}
            <g className="dino-leg-a">
              <path d="M56 74 L52 88 L44 88 L44 94 L64 94 L64 88 L61 74 Z" />
            </g>
            {/* kaki depan (dekat) */}
            <g className="dino-leg-b">
              <path d="M84 74 L88 88 L80 88 L80 94 L100 94 L100 88 L93 74 Z" />
            </g>
          </svg>
        </div>
      </div>

      <p className="mt-8 text-sm font-semibold tracking-wide">
        {t("loadingTitle")}
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
        <span className="loading-dot">.</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t("loadingBody")}</p>
    </div>
  );
}
