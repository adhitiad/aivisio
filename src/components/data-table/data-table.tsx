"use client";

import { useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Nama kolom untuk filter global (data jalan lewat getFilterValue di tiap kolom) */
  searchKeys?: string[];
  enableRowSelection?: boolean;
  /** Dipanggil dengan baris yang dipilih saat klik "Hapus terpilih" */
  onBulkDelete?: (rows: TData[]) => void;
  getRowId?: (row: TData) => string;
  initialPageSize?: number;
  toolbarLeft?: React.ReactNode;
}

/**
 * Tabel data reusable — sorting, filtering (global + per kolom),
 * pagination, column visibility, dan row selection.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  enableRowSelection = true,
  onBulkDelete,
  getRowId,
  initialPageSize = 10,
  toolbarLeft,
}: DataTableProps<TData, TValue>) {
  const t = useT("dashboard.table");
  const tCommon = useT("common");

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: initialPageSize } },
  });

  const selectedCount = Object.keys(rowSelection).length;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Toolbar: search + kolom + bulk action */}
      <div className="flex flex-wrap items-center gap-2">
        {toolbarLeft}
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={t("search")}
            className="pl-8"
            aria-label={t("search")}
          />
          {globalFilter && (
            <button
              type="button"
              onClick={() => setGlobalFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("clearFilter")}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Columns3 className="h-4 w-4" aria-hidden="true" />
              {t("columns")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(v) => column.toggleVisibility(!!v)}
                >
                  {typeof column.columnDef.header === "string"
                    ? column.columnDef.header
                    : column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {onBulkDelete && selectedCount > 0 && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const rows = table.getSelectedRowModel().rows.map((r) => r.original);
              onBulkDelete(rows);
              setRowSelection({});
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {tCommon("delete")} ({selectedCount})
          </Button>
        )}
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 font-semibold hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={`Sort ${String(
                            typeof header.column.columnDef.header === "string"
                              ? header.column.columnDef.header
                              : header.column.id
                          )}`}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ArrowUpDown
                              className="h-3.5 w-3.5 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                      {/* Filter per kolom */}
                      {header.column.getCanFilter() &&
                        typeof header.column.columnDef.header === "string" &&
                        header.column.columnDef.meta &&
                        (header.column.columnDef.meta as { filterable?: boolean })
                          ?.filterable !== false && (
                          <Input
                            value={(header.column.getFilterValue() as string) ?? ""}
                            onChange={(e) =>
                              header.column.setFilterValue(e.target.value)
                            }
                            placeholder="…"
                            className="mt-1.5 h-7 w-full text-xs font-normal"
                            aria-label={`Filter ${header.column.id}`}
                          />
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(row.getIsSelected() && "bg-muted/60")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {t("noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer: seleksi + pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span aria-live="polite">
          {enableRowSelection
            ? t("selected", { count: selectedCount })
            : `${filteredCount}`}
        </span>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            {t("rowsPerPage")}
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger className="h-8 w-16" aria-label={t("rowsPerPage")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <span className="tabular-nums">
            {t("pageOf", {
              page: table.getState().pagination.pageIndex + 1,
              total: Math.max(1, table.getPageCount()),
            })}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Kolom checkbox seleksi siap pakai */
export function selectionColumn<TData>(selectRowLabel = "Select row"): ColumnDef<TData> {
  return {
    id: "select",
    enableHiding: false,
    enableSorting: false,
    enableColumnFilter: false,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label={selectRowLabel}
        onClick={(e) => e.stopPropagation()}
      />
    ),
  };
}
