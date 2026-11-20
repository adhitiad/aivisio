"use client";

import { useTransition } from "react";
import { useRouter } from "@tanstack/react-router";
import { useLocale, useT } from "@/lib/i18n";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useT("nav");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const next = locale === "id" ? "en" : "id";

  function switchLocale() {
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      router.invalidate();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 font-semibold uppercase"
      onClick={switchLocale}
      disabled={pending}
      aria-label={`${t("toggleLocale")} (${locale.toUpperCase()})`}
      title={t("toggleLocale")}
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      {locale}
    </Button>
  );
}
