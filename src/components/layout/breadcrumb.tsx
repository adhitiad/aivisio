"use client";

import { Link } from "@tanstack/react-router";
import { usePathname } from "@/lib/router";
import { ChevronRight, Home } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SEGMENT_KEYS: Record<string, string> = {
  dashboard: "dashboard.breadcrumbRoot",
  history: "dashboard.history",
  videos: "dashboard.videos",
  providers: "dashboard.providers",
  messages: "dashboard.messages",
  settings: "dashboard.settings",
};

export function DashboardBreadcrumb() {
  const pathname = usePathname();
  const t = useT();

  const segments = pathname.split("/").filter(Boolean); // ['dashboard', ...]
  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const key = SEGMENT_KEYS[seg];
    const label = key ? t(key) : seg;
    return { href, label, isLast: i === segments.length - 1 };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/" aria-label={t("common.home")}>
              <Home className="h-4 w-4" aria-hidden="true" />
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb) => (
          <BreadcrumbItem key={crumb.href}>
            <BreadcrumbSeparator>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </BreadcrumbSeparator>
            {crumb.isLast ? (
              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link to={crumb.href as never}>{crumb.label}</Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
