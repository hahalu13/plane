import * as React from "react";
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  Table as TanstackTable,
  PaginationState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { useTranslation } from "@plane/i18n";
import { EmptyStateCompact } from "@plane/propel/empty-state";
import { SearchIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon } from "@plane/propel/icons";
import { Button } from "@plane/propel/button";
// plane package imports
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@plane/propel/table";
import { cn } from "@plane/utils";
// plane web components

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchPlaceholder: string;
  actions?: (table: TanstackTable<TData>) => React.ReactNode;
  enablePagination?: boolean;
  pageSize?: number;
}

export function DataTable<TData, TValue>({ 
  columns, 
  data, 
  searchPlaceholder, 
  actions,
  enablePagination = false,
  pageSize = 10,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSize,
  });
  const [globalFilter, setGlobalFilter] = React.useState("");
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
      ...(enablePagination ? { pagination } : {}),
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      // Get the cell value and convert to string for searching
      const cellValue = row.getValue(columnId);
      const stringValue = String(cellValue || '').toLowerCase();
      const searchValue = String(filterValue || '').toLowerCase();

      return stringValue.includes(searchValue);
    },
    ...(enablePagination ? { onPaginationChange: setPagination } : {}),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    ...(enablePagination ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    ...(enablePagination ? { manualPagination: false } : {}),
  });

  return (
    <div className="space-y-4">
      <div className="flex w-full items-center justify-between">
        <div className="relative flex max-w-[300px] items-center gap-4 ">
          {table.getHeaderGroups()?.[0]?.headers?.[0]?.id && (
            <div className="flex items-center gap-2 whitespace-nowrap text-13 text-placeholder">
              {searchPlaceholder}
            </div>
          )}
          {!isSearchOpen && (
            <button
              type="button"
              className="-mr-5 grid place-items-center rounded-sm p-2 text-placeholder hover:bg-layer-1"
              onClick={() => {
                setIsSearchOpen(true);
                inputRef.current?.focus();
              }}
            >
              <SearchIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <div
            className={cn(
              "mr-auto flex w-0 items-center justify-start gap-1 overflow-hidden rounded-md border border-transparent bg-surface-1 text-placeholder opacity-0 transition-[width] ease-linear",
              {
                "w-64 border-subtle px-2.5 py-1.5 opacity-100": isSearchOpen,
              }
            )}
          >
            <SearchIcon className="h-3.5 w-3.5" />
            <input
              ref={inputRef}
              className="w-full max-w-[234px] border-none bg-transparent text-13 text-primary placeholder:text-placeholder focus:outline-none"
              placeholder={searchPlaceholder || t("analytics.common.search")}
              value={globalFilter}
              onChange={(e) => {
                setGlobalFilter(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setIsSearchOpen(true);
                }
              }}
            />
            {isSearchOpen && (
              <button
                type="button"
                className="grid place-items-center"
                onClick={() => {
                  setGlobalFilter("");
                  setIsSearchOpen(false);
                }}
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        {actions && <div>{actions(table)}</div>}
      </div>

      <div className="rounded-md">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className="whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : (flexRender(header.column.columnDef.header, header.getContext()) as any)}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext()) as any}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyStateCompact
                    assetKey="unknown"
                    assetClassName="size-20"
                    rootClassName="border border-subtle px-5 py-10 md:py-20 md:px-20"
                    title={t("workspace_empty_state.analytics_work_items.title")}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {enablePagination && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t-[0.5px] border-subtle">
          <div className="flex items-center gap-2 text-13 text-secondary">
            <span>
              {t("analytics.common.showing") || "Showing"} {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} -{" "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                table.getFilteredRowModel().rows.length
              )}{" "}
              {t("analytics.common.of") || "of"} {table.getFilteredRowModel().rows.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              prependIcon={<ChevronLeftIcon className="h-4 w-4" />}
            >
              {t("common.previous") || "Previous"}
            </Button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, table.getPageCount()) }, (_, i) => {
                const pageIndex = table.getState().pagination.pageIndex;
                const totalPages = table.getPageCount();
                let pageNum: number;
                
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (pageIndex < 3) {
                  pageNum = i;
                } else if (pageIndex > totalPages - 4) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = pageIndex - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={pageIndex === pageNum ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => table.setPageIndex(pageNum)}
                    className="min-w-[32px]"
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              appendIcon={<ChevronRightIcon className="h-4 w-4" />}
            >
              {t("common.next") || "Next"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
