"use client";

import { Link } from "@tanstack/react-router";
import { CircleLetterYIcon } from "lucide-react";
import { useT } from "@/lib/i18n";
import { SiteLogo } from "@/components/brand/site-logo";

export function Footer({
  siteName,
  logoUrl,
}: {
  siteName: string;
  logoUrl: string;
}) {
  const t = useT();
  const year = new Date().getFullYear();

  const links = [
    { href: "/about" as const, label: t("footer.about") },
    { href: "/contact" as const, label: t("footer.contact") },
    { href: "/tos" as const, label: t("footer.tos") },
    { href: "/privacy" as const, label: t("footer.privacy") },
    { href: "/policy" as const, label: t("footer.policy") },
    { href: "/sitemap.xml" as never, label: t("footer.sitemap") },
  ];

  return (
    <footer className="mt-auto border-t border-border bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 py-7 text-center sm:flex-row sm:px-6 sm:text-left">
        <div className="flex items-center gap-2.5">
          <SiteLogo logoUrl={logoUrl} size={30} className="text-foreground" />
          <div>
            <p className="text-sm font-bold tracking-tight">
              {siteName || "AIVISO"}
            </p>
            <p className="text-[10px] text-muted-foreground">© {year} — All rights reserved.</p>
          </div>
        </div>

        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          {t("footer.rights")}
        </p>

        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Footer">
          {links.map((l) => (
            <Link
              key={l.href}
              to={l.href}
              className="transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/"
            hash="studio"
            className="flex items-center gap-1 text-cyan-600 transition-colors hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200"
          >
            <CircleLetterYIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {t("footer.backToTop")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
