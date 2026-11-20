"use client";

import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export function RootNotFound() {
  const t = useT("errors");

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Compass className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      </span>
      <p className="text-6xl font-black tracking-tighter text-brand-gradient">404</p>
      <h1 className="text-xl font-bold tracking-tight">{t("notFoundTitle")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("notFoundBody")}</p>
      <Button
        asChild
        className="mt-2 bg-brand-gradient font-semibold text-slate-950 hover:opacity-90"
      >
        <Link to="/">{t("notFoundCta")}</Link>
      </Button>
    </main>
  );
}
