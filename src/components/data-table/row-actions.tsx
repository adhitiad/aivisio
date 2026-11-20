"use client";

import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface RowAction {
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  destructive?: boolean;
  separatorBefore?: boolean;
}

/** Dropdown "⋯" aksi per baris — dipakai semua tabel dashboard. */
export function RowActions({ actions }: { actions: RowAction[] }) {
  const t = useT("dashboard.table");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t("actions")}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <div key={`${action.label}-${i}`}>
              {action.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onSelect={action.onSelect}
                className={cn(
                  action.destructive && "text-destructive focus:text-destructive"
                )}
              >
                {Icon && <Icon className="mr-2 h-4 w-4" aria-hidden="true" />}
                {action.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
