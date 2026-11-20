"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { usePathname } from "@/lib/router";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { signOut } from "@/lib/auth-client";
import { SiteLogo } from "@/components/brand/site-logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LiveClock } from "./live-clock";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { NotificationBell } from "./notification-bell";

interface NavbarUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

export function NavbarClient({
  siteName,
  logoUrl,
  user,
}: {
  siteName: string;
  logoUrl: string;
  user: NavbarUser | null;
}) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    queueMicrotask(() => setMenuOpen(false));
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [menuOpen]);

  const initials =
    user?.name
      ?.split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() ??
    user?.email?.[0]?.toUpperCase() ??
    "?";

  const anchorLinks = [
    { hash: "studio", label: t("nav.studio") },
    { hash: "video", label: t("nav.video") },
    { hash: "prompt", label: t("nav.prompts") },
    { hash: "riwayat", label: t("nav.history") },
  ];

  async function handleSignOut() {
    await signOut();
    router.invalidate();
    router.navigate({ to: "/" });
  }

  return (
    <header
      ref={menuRef}
      className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl"
    >
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Kiri: logo + nama */}
        <Link
          to="/"
          className="flex items-center gap-2 rounded-md pr-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${siteName} — ${t("common.home")}`}
        >
          <SiteLogo logoUrl={logoUrl} size={26} className="text-foreground" />
          <span className="text-lg font-extrabold tracking-tight">{siteName}</span>
        </Link>

        {/* Tengah: waktu hari ini */}
        <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 md:block">
          <LiveClock className="text-[11px] font-medium tabular-nums text-foreground/80 lg:text-xs" />
        </div>

        {/* Kanan: kontrol */}
        <div className="flex items-center gap-0.5 sm:gap-1.5">
          <ThemeToggle />
          <LocaleSwitcher />
          {user && <NotificationBell />}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 pl-1.5"
                  aria-label={user.name ?? user.email ?? "user"}
                >
                  <Avatar className="h-7 w-7">
                    {user.image && (
                      <AvatarImage src={user.image} alt={user.name ?? ""} />
                    )}
                    <AvatarFallback className="text-[10px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate text-sm font-medium">
                    {user.name ?? "—"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("nav.dashboard")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/dashboard/settings">{t("nav.settings")}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              asChild
              size="sm"
              className="bg-brand-gradient font-semibold text-slate-950 hover:opacity-90"
            >
              <Link to="/login" search={{ error: undefined }}>
                {t("nav.login")}
              </Link>
            </Button>
          )}

          {/* Hamburger (mobile) */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Jam untuk mobile */}
      <div className="border-t border-border/60 py-1 text-center md:hidden">
        <LiveClock className="text-[10px] font-medium tabular-nums text-foreground/80" />
      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto grid max-w-6xl gap-1 px-4 py-3 text-sm" aria-label="Mobile">
            {anchorLinks.map((l) => (
              <Link
                key={l.hash}
                to="/"
                hash={l.hash}
                className="rounded-md px-3 py-2 hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            <Link to="/dashboard" className="rounded-md px-3 py-2 hover:bg-muted">
              {t("nav.dashboard")}
            </Link>
            <Link to="/about" className="rounded-md px-3 py-2 hover:bg-muted">
              {t("footer.about")}
            </Link>
            <Link to="/contact" className="rounded-md px-3 py-2 hover:bg-muted">
              {t("footer.contact")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
