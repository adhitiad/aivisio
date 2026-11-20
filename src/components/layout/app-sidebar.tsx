"use client";

import { Link } from "@tanstack/react-router";
import { usePathname } from "@/lib/router";
import {
  Clapperboard,
  ChartLine,
  History,
  LayoutDashboard,
  Mail,
  Plug,
  Search,
  Settings,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV = [
  { href: "/dashboard", key: "overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/history", key: "history", icon: History, exact: false },
  { href: "/dashboard/videos", key: "videos", icon: Clapperboard, exact: false },
  { href: "/dashboard/research", key: "research", icon: Search, exact: false },
  { href: "/dashboard/analytics", key: "analytics", icon: ChartLine, exact: false },
  { href: "/dashboard/providers", key: "providers", icon: Plug, exact: false },
  { href: "/dashboard/messages", key: "messages", icon: Mail, exact: false },
  { href: "/dashboard/settings", key: "settings", icon: Settings, exact: false },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const t = useT("dashboard");

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("title")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={t(item.key)}
                    >
                      <Link to={item.href}>
                        <Icon aria-hidden="true" />
                        <span>{t(item.key)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
