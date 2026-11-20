"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { Copy, Eye, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, selectionColumn } from "@/components/data-table/data-table";
import { RowActions } from "@/components/data-table/row-actions";
import { ConfirmDialog } from "@/components/data-table/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

export interface VideoRow {
  id: string;
  topic: string;
  title: string | null;
  format: string;
  status: string;
  progress: number;
  durationSec: number;
  fileBytes: number;
  createdAt: string;
  updatedAt: string;
}

const helper = createColumnHelper<VideoRow>();

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  done: "default",
  error: "destructive",
  queued: "secondary",
  planning: "secondary",
  building: "secondary",
  stitching: "secondary",
};

export function VideosTable({ items }: { items: VideoRow[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [viewing, setViewing] = useState<VideoRow | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<VideoRow[]>([]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "id" ? "id-ID" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  async function deleteRows(rows: VideoRow[]) {
    try {
      await Promise.all(
        rows.map((r) => fetch(`/api/video?id=${r.id}`, { method: "DELETE" }))
      );
      toast({ title: t("dashboard.deleted") });
      router.invalidate();
    } catch {
      toast({ title: t("dashboard.deleteFailed"), variant: "destructive" });
    }
  }

  const columns: ColumnDef<VideoRow, any>[] = [
    selectionColumn<VideoRow>(t("dashboard.table.selectRow")) as ColumnDef<VideoRow, any>,
    helper.accessor("topic", {
      id: "topic",
      header: t("dashboard.columns.topic"),
      cell: (info) => (
        <span className="line-clamp-1 max-w-[240px] font-medium">{info.getValue()}</span>
      ),
    }) as ColumnDef<VideoRow, any>,
    helper.accessor("format", {
      id: "format",
      header: t("dashboard.columns.format"),
      enableColumnFilter: true,
      cell: (info) => <Badge variant="outline">{info.getValue()}</Badge>,
    }) as ColumnDef<VideoRow, any>,
    helper.accessor("status", {
      id: "status",
      header: t("dashboard.columns.status"),
      enableColumnFilter: true,
      cell: (info) => (
        <Badge variant={STATUS_VARIANT[info.getValue()] ?? "secondary"}>
          {info.getValue()}
        </Badge>
      ),
    }) as ColumnDef<VideoRow, any>,
    helper.accessor("progress", {
      id: "progress",
      header: t("dashboard.columns.progress"),
      enableColumnFilter: false,
      cell: (info) => (
        <div className="flex w-28 items-center gap-2">
          <Progress value={info.getValue()} className="h-2 flex-1" />
          <span className="text-xs tabular-nums text-muted-foreground">
            {info.getValue()}%
          </span>
        </div>
      ),
    }) as ColumnDef<VideoRow, any>,
    helper.accessor("createdAt", {
      id: "createdAt",
      header: t("dashboard.columns.createdAt"),
      enableColumnFilter: false,
      cell: (info) => (
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {fmt(info.getValue())}
        </span>
      ),
    }) as ColumnDef<VideoRow, any>,
    helper.accessor("updatedAt", {
      id: "updatedAt",
      header: t("dashboard.columns.updatedAt"),
      enableColumnFilter: false,
      cell: (info) => (
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {fmt(info.getValue())}
        </span>
      ),
    }) as ColumnDef<VideoRow, any>,
    helper.display({
      id: "actions",
      header: t("dashboard.columns.actions"),
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          actions={[
            { label: t("dashboard.rowActions.view"), icon: Eye, onSelect: () => setViewing(row.original) },
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
    }) as ColumnDef<VideoRow, any>,
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.videos")}</h1>

      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        onBulkDelete={(rows) => setPendingDeletes(rows)}
      />

      {/* Dialog detail */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="line-clamp-2 text-base">
              {viewing?.title ?? viewing?.topic}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("dashboard.columns.topic")}</dt>
              <dd className="font-medium">{viewing.topic}</dd>
              <dt className="text-muted-foreground">{t("dashboard.columns.format")}</dt>
              <dd>{viewing.format}</dd>
              <dt className="text-muted-foreground">{t("dashboard.columns.status")}</dt>
              <dd><Badge variant="secondary">{viewing.status}</Badge></dd>
              <dt className="text-muted-foreground">{t("dashboard.columns.progress")}</dt>
              <dd>{viewing.progress}%</dd>
              <dt className="text-muted-foreground">{t("dashboard.columns.createdAt")}</dt>
              <dd className="tabular-nums">{fmt(viewing.createdAt)}</dd>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="truncate font-mono text-xs">{viewing.id}</dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDeletes.length > 0}
        onOpenChange={(open) => !open && setPendingDeletes([])}
        description={`${t("dashboard.deleteConfirm")} (${pendingDeletes.length})`}
        onConfirm={() => deleteRows(pendingDeletes)}
      />
    </div>
  );
}
