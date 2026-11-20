"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  ColumnDef,
  createColumnHelper,
} from "@tanstack/react-table";
import { Copy, Eye, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, selectionColumn } from "@/components/data-table/data-table";
import { RowActions } from "@/components/data-table/row-actions";
import { ConfirmDialog } from "@/components/data-table/confirm-dialog";
import { MarkdownView } from "@/components/aiviso/markdown-view";
import { useToast } from "@/hooks/use-toast";

export interface HistoryRow {
  id: string;
  toolId: string;
  title: string;
  inputs: string;
  createdAt: string;
  updatedAt: string;
}

const helper = createColumnHelper<HistoryRow>();

export function HistoryTable({ items }: { items: HistoryRow[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [viewing, setViewing] = useState<HistoryRow | null>(null);
  const [viewOutput, setViewOutput] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<HistoryRow[]>([]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "id" ? "id-ID" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  async function viewItem(row: HistoryRow) {
    setViewing(row);
    setViewOutput(null);
    setViewLoading(true);
    try {
      const res = await fetch(`/api/history?id=${row.id}`);
      const data = await res.json();
      setViewOutput(typeof data.output === "string" ? data.output : "");
    } catch {
      setViewOutput("");
    } finally {
      setViewLoading(false);
    }
  }

  async function deleteRows(rows: HistoryRow[]) {
    try {
      await Promise.all(
        rows.map((r) => fetch(`/api/history?id=${r.id}`, { method: "DELETE" }))
      );
      toast({ title: t("dashboard.deleted") });
      router.invalidate();
    } catch {
      toast({ title: t("dashboard.deleteFailed"), variant: "destructive" });
    }
  }

  const columns: ColumnDef<HistoryRow, any>[] = [
    selectionColumn<HistoryRow>(t("dashboard.table.selectRow")) as ColumnDef<HistoryRow, any>,
    helper.accessor("title", {
      id: "title",
      header: t("dashboard.columns.title"),
      cell: (info) => (
        <span className="line-clamp-1 max-w-[280px] font-medium">
          {info.getValue()}
        </span>
      ),
    }) as ColumnDef<HistoryRow, any>,
    helper.accessor("toolId", {
      id: "tool",
      header: t("dashboard.columns.tool"),
      enableColumnFilter: true,
      cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
    }) as ColumnDef<HistoryRow, any>,
    helper.accessor("createdAt", {
      id: "createdAt",
      header: t("dashboard.columns.createdAt"),
      enableColumnFilter: false,
      cell: (info) => (
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {fmt(info.getValue())}
        </span>
      ),
    }) as ColumnDef<HistoryRow, any>,
    helper.accessor("updatedAt", {
      id: "updatedAt",
      header: t("dashboard.columns.updatedAt"),
      enableColumnFilter: false,
      cell: (info) => (
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {fmt(info.getValue())}
        </span>
      ),
    }) as ColumnDef<HistoryRow, any>,
    helper.display({
      id: "actions",
      header: t("dashboard.columns.actions"),
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          actions={[
            { label: t("dashboard.rowActions.view"), icon: Eye, onSelect: () => viewItem(row.original) },
            {
              label: t("dashboard.rowActions.copyId"),
              icon: Copy,
              onSelect: () => {
                navigator.clipboard?.writeText(row.original.id);
                toast({ title: t("common.copied") });
              },
            },
            {
              label: t("dashboard.rowActions.delete"),
              icon: Trash2,
              destructive: true,
              separatorBefore: true,
              onSelect: () => setPendingDeletes([row.original]),
            },
          ]}
        />
      ),
    }) as ColumnDef<HistoryRow, any>,
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.history")}</h1>

      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        onBulkDelete={(rows) => setPendingDeletes(rows)}
      />

      {/* Dialog lihat output */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="line-clamp-2 pr-6 text-base">
              {viewing?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto aiviso-scroll">
            {viewLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("common.loading")}…
              </p>
            ) : (
              viewOutput && <MarkdownView content={viewOutput} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        open={pendingDeletes.length > 0}
        onOpenChange={(open) => !open && setPendingDeletes([])}
        description={`${t("dashboard.deleteConfirm")} (${pendingDeletes.length})`}
        onConfirm={() => deleteRows(pendingDeletes)}
      />
    </div>
  );
}
