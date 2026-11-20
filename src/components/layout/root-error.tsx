"use client";

import { useEffect } from "react";
import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export function RootError({ error, reset }: ErrorComponentProps) {
  const t = useT("errors");
  const err = error as Error & { digest?: string };

  useEffect(() => {
    logger.error({ err }, "root error boundary tertangkap");
  }, [err]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold tracking-tight">{t("errorTitle")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("errorBody")}</p>
      {err.digest && (
        <p className="font-mono text-[10px] text-muted-foreground">digest: {err.digest}</p>
      )}
      <div className="flex gap-2 pt-2">
        <Button onClick={reset} className="bg-brand-gradient font-semibold text-slate-950 hover:opacity-90">
          {t("retry")}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">{t("notFoundCta")}</Link>
        </Button>
      </div>
    </main>
  );
}
