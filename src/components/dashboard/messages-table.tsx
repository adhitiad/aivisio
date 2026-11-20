"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { Archive, Eye, MailOpen, Trash2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

export interface MessageRow {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const helper = createColumnHelper<MessageRow>();

export function MessagesTable({ items }: { items: MessageRow[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [viewing, setViewing] = useState<MessageRow | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<MessageRow[]>([]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "id" ? "id-ID" : "en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  async function setStatus(id: string, status: string) {
    await fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    router.invalidate();
  }

  async function deleteRows(rows: MessageRow[]) {
    await Promise.all(
      rows.map((r) => fetch(`/api/messages?id=${r.id}`, { method: "DELETE" }))
    );
    toast({ title: t("dashboard.deleted") });
    router.invalidate();
  }

  const columns: ColumnDef<MessageRow, any>[] = [
    selectionColumn<MessageRow>(t("dashboard.table.selectRow")) as ColumnDef<MessageRow, any>,
    helper.accessor("name", {
      id: "name",
      header: t("dashboard.columns.name"),
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }) as ColumnDef<MessageRow, any>,
    helper.accessor("email", {
      id: "email",
      header: t("dashboard.columns.email"),
      cell: (info) => (
        <span className="text-xs text-muted-foreground">{info.getValue()}</span>
      ),
    }) as ColumnDef<MessageRow, any>,
    helper.accessor("subject", {
      id: "subject",
      header: t("dashboard.columns.subject"),
      cell: (info) => (
        <span className="line-clamp-1 max-w-[200px]">
          {info.getValue() ?? "—"}
        </span>
      ),
    }) as ColumnDef<MessageRow, any>,
    helper.accessor("status", {
      id: "status",
      header: t("dashboard.columns.status"),
      enableColumnFilter: true,
      cell: (info) => (
        <Badge
          variant={
            info.getValue() === "new"
              ? "default"
              : info.getValue() === "archived"
                ? "outline"
                : "secondary"
          }
        >
          {info.getValue()}
        </Badge>
      ),
    }) as ColumnDef<MessageRow, any>,
    helper.accessor("createdAt", {
      id: "createdAt",
      header: t("dashboard.columns.createdAt"),
      enableColumnFilter: false,
      cell: (info) => (
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {fmt(info.getValue())}
        </span>
      ),
    }) as ColumnDef<MessageRow, any>,
    helper.display({
      id: "actions",
      header: t("dashboard.columns.actions"),
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              label: t("dashboard.rowActions.view"),
              icon: Eye,
              onSelect: () => {
                setViewing(row.original);
                if (row.original.status === "new") setStatus(row.original.id, "read");
              },
            },
            {
              label: t("dashboard.rowActions.markRead"),
              icon: MailOpen,
              onSelect: () => setStatus(row.original.id, "read"),
            },
            {
              label: t("dashboard.rowActions.markArchived"),
              icon: Archive,
              onSelect: () => setStatus(row.original.id, "archived"),
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
    }) as ColumnDef<MessageRow, any>,
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.messages")}</h1>

      <DataTable
        columns={columns}
        data={items}
        getRowId={(r) => r.id}
        onBulkDelete={(rows) => setPendingDeletes(rows)}
      />

      {/* Dialog baca pesan */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {viewing?.subject ?? t("dashboard.messages")}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-xs text-muted-foreground">
                {viewing.name} · {viewing.email} · {fmt(viewing.createdAt)}
              </p>
              <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 leading-relaxed">
                {viewing.message}
              </p>
            </div>
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
