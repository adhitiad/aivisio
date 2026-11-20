"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { Copy, Loader2, Plug, Power, Zap } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, selectionColumn } from "@/components/data-table/data-table";
import { RowActions } from "@/components/data-table/row-actions";
import { useToast } from "@/hooks/use-toast";

export interface ProviderRow {
  id: string;
  key: string;
  label: string;
  model: string;
  enabled: boolean;
  active: boolean;
  status: string;
  statusMessage: string | null;
  keyMask: string;
  updatedAt: string;
}

const helper = createColumnHelper<ProviderRow>();

export function ProvidersTable({ items }: { items: ProviderRow[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [testing, setTesting] = useState<string | null>(null);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "id" ? "id-ID" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  async function testProvider(row: ProviderRow) {
    setTesting(row.key);
    try {
      const res = await fetch("/api/ai-providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: row.key }),
      });
      const data = await res.json();
      toast({
        title: res.ok && data.ok ? `OK — ${row.label}` : `Gagal — ${row.label}`,
        description: data.error ?? data.statusMessage ?? undefined,
        variant: res.ok && data.ok ? "default" : "destructive",
      });
      router.invalidate();
    } catch {
      toast({ title: t("dashboard.deleteFailed"), variant: "destructive" });
    } finally {
      setTesting(null);
    }
  }

  async function toggleActive(row: ProviderRow) {
    await fetch("/api/ai-providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: row.key, active: !row.active }),
    });
    router.invalidate();
  }

  const columns: ColumnDef<ProviderRow, any>[] = [
    selectionColumn<ProviderRow>(t("dashboard.table.selectRow")) as ColumnDef<ProviderRow, any>,
    helper.accessor("label", {
      id: "label",
      header: t("dashboard.columns.label"),
      cell: (info) => (
        <div className="max-w-[220px]">
          <span className="block truncate font-medium">{info.getValue()}</span>
          <span className="block truncate font-mono text-[10px] text-muted-foreground">
            {info.row.original.key}
          </span>
        </div>
      ),
    }) as ColumnDef<ProviderRow, any>,
    helper.accessor("model", {
      id: "model",
      header: t("dashboard.columns.model"),
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">
          {info.getValue() || "—"}
        </span>
      ),
    }) as ColumnDef<ProviderRow, any>,
    helper.accessor("keyMask", {
      id: "key",
      header: t("dashboard.columns.key"),
      enableSorting: false,
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">
          {info.getValue() || "—"}
        </span>
      ),
    }) as ColumnDef<ProviderRow, any>,
    helper.accessor("status", {
      id: "status",
      header: t("dashboard.columns.status"),
      enableColumnFilter: true,
      cell: (info) => (
        <Badge
          variant={
            info.getValue() === "ok"
              ? "default"
              : info.getValue() === "error"
                ? "destructive"
                : "secondary"
          }
          title={info.row.original.statusMessage ?? undefined}
        >
          {info.getValue()}
        </Badge>
      ),
    }) as ColumnDef<ProviderRow, any>,
    helper.accessor("enabled", {
      id: "enabled",
      header: t("dashboard.columns.enabled"),
      enableColumnFilter: false,
      cell: (info) => (
        <Badge variant={info.getValue() ? "default" : "outline"}>
          {info.getValue() ? "✓" : "—"}
        </Badge>
      ),
    }) as ColumnDef<ProviderRow, any>,
    helper.accessor("updatedAt", {
      id: "updatedAt",
      header: t("dashboard.columns.updatedAt"),
      enableColumnFilter: false,
      cell: (info) => (
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {fmt(info.getValue())}
        </span>
      ),
    }) as ColumnDef<ProviderRow, any>,
    helper.display({
      id: "actions",
      header: t("dashboard.columns.actions"),
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      cell: ({ row }) => {
        const isTesting = testing === row.original.key;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={isTesting}
              onClick={() => testProvider(row.original)}
              aria-label={t("dashboard.rowActions.test")}
              title={t("dashboard.rowActions.test")}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Zap className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
            <RowActions
              actions={[
                {
                  label: row.original.active
                    ? t("dashboard.rowActions.deactivate")
                    : t("dashboard.rowActions.activate"),
                  icon: row.original.active ? Power : Plug,
                  onSelect: () => toggleActive(row.original),
                },
                {
                  label: t("dashboard.rowActions.copyId"),
                  icon: Copy,
                  onSelect: () => {
                    navigator.clipboard?.writeText(row.original.key);
                    toast({ title: t("common.copied") });
                  },
                },
              ]}
            />
          </div>
        );
      },
    }) as ColumnDef<ProviderRow, any>,
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.providers")}</h1>

      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        initialPageSize={10}
      />
    </div>
  );
}
