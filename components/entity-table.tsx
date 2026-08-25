"use client"

import * as React from "react"
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table"
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTranslations } from "next-intl"

const features = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
})

// Matches tanstack/table-core's own RowData constraint (Record<string, any> | any[]).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function entityColumnHelper<TData extends Record<string, any>>() {
  return createColumnHelper<typeof features, TData>()
}

type EntityTableProps<TData extends { id: string }> = {
  columns: ReturnType<ReturnType<typeof createColumnHelper<typeof features, TData>>["columns"]>
  data: TData[]
  isLoading?: boolean
  searchPlaceholder?: string
  /** Runs against the (already unfiltered) row before search text is applied. */
  matchesSearch?: (row: TData, query: string) => boolean
  toolbarExtra?: React.ReactNode
  emptyMessage?: string
  onRowClick?: (row: TData) => void
}

export function EntityTable<TData extends { id: string }>({
  columns,
  data,
  isLoading,
  searchPlaceholder,
  matchesSearch,
  toolbarExtra,
  emptyMessage,
  onRowClick,
}: EntityTableProps<TData>) {
  const t = useTranslations("DataTable")
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  const filtered = React.useMemo(() => {
    if (!search || !matchesSearch) return data
    const query = search.trim().toLowerCase()
    if (!query) return data
    return data.filter((row) => matchesSearch(row, query))
  }, [data, search, matchesSearch])

  const table = useTable({
    features,
    data: filtered,
    columns,
    state: { sorting, pagination },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  })

  const rows = table.getRowModel().rows

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {matchesSearch && (
          <div className="relative w-64">
            <SearchIcon className="pointer-events-none absolute top-1/2 start-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="ps-8"
            />
          </div>
        )}
        {toolbarExtra}
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : <FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {t("loading")}
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage ?? t("noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>{t("rowCount", { count: filtered.length })}</div>
        <div className="flex items-center gap-4">
          <div>
            {t("pageOf", {
              page: table.state.pagination.pageIndex + 1,
              pages: Math.max(1, table.getPageCount()),
            })}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.firstPage()}
            >
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!table.getCanNextPage()}
              onClick={() => table.lastPage()}
            >
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
