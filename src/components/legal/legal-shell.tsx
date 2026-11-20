import type { ReactNode } from "react";

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-1.5">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">{updated}</p>
      <div className="mt-8 grid gap-6">{children}</div>
    </main>
  );
}
