"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

/**
 * Jam hidup untuk navbar — format:
 * "Hari, DD Bulan YYYY || JJ:MM" (id: "Kamis, 19 November 2026 || 14:05").
 * Menggunakan locale id-ID / en-GB agar urutan selalu DD Bulan YYYY.
 */
export function LiveClock({ className }: { className?: string }) {
  const locale = useLocale();
  const tag = locale === "en" ? "en-GB" : "id-ID";
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setInterval(tick, 1000);
    queueMicrotask(tick); // di luar body effect langsung — hindari cascading render
    return () => clearInterval(t);
  }, []);

  if (!now) {
    // Placeholder agar tidak hydration mismatch.
    return <span className={className} aria-hidden="true">•••</span>;
  }

  const date = new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);

  const time = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;

  return (
    <time
      dateTime={now.toISOString()}
      title={now.toLocaleTimeString(tag)}
      className={className}
    >
      {date} <span className="text-muted-foreground">||</span> {time}
    </time>
  );
}
