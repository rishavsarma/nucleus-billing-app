"use client"

import * as React from "react"
import {
  columnVisibilityFeature,
  createColumnHelper,
  FlexRender,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnVisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Columns3Icon,
  SearchIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const features = tableFeatures({
  columnVisibilityFeature,
  rowSelectionFeature,
})

// Matches tanstack/table-core's own RowData constraint (Record<string, any> | any[]).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function entityColumnHelper<TData extends Record<string, any>>() {
  return createColumnHelper<typeof features, TData>()
}

export type EntityTableProps<TData extends { id: string }> = {
  columns: ReturnType<ReturnType<typeof createColumnHelper<typeof features, TData>>["columns"]>
  data: TData[]
  isLoading?: boolean
  emptyMessage?: string
  onRowClick?: (row: TData) => void
  showColumnVisibility?: boolean
  pageSizeOptions?: number[]
  enableRowSelection?: boolean
  onRowSelectionChange?: (selectedRows: TData[]) => void

  // ---- Controlled (server-side) pagination + search ----
  /** Total number of rows matching the current search (from the server). */
  totalCount: number
  /** Current page index (1-based). */
  page: number
  /** Current page size. */
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  /** Current search string (controlled by parent). */
  search: string
  onSearchChange: (search: string) => void
  /** Placeholder for the search input. */
  searchPlaceholder?: string
  /** Set false to hide the search box entirely (e.g. pages with no searchable columns). */
  showSearch?: boolean
  /** Extra toolbar content rendered between the search box and Columns button. */
  toolbarExtra?: React.ReactNode
}

export function EntityTable<TData extends { id: string }>({
  columns,
  data,
  isLoading,
  emptyMessage,
  onRowClick,
  showColumnVisibility = true,
  pageSizeOptions = [10, 20, 30, 40, 50],
  enableRowSelection = true,
  onRowSelectionChange,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  search,
  onSearchChange,
  searchPlaceholder,
  showSearch = true,
  toolbarExtra,
}: EntityTableProps<TData>) {
  const t = useTranslations("DataTable")
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

  const columnHelper = React.useMemo(() => entityColumnHelper<TData>(), [])

  const allColumns = React.useMemo(() => {
    if (!enableRowSelection) return columns

    const selectColumn = columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div
          className="flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
    })

    return [selectColumn, ...columns]
  }, [columns, enableRowSelection, columnHelper])

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))

  const table = useTable({
    features,
    data,
    columns: allColumns,
    state: {
      columnVisibility,
      rowSelection,
    },
    getRowId: (row) => row.id,
    enableRowSelection,
    onRowSelectionChange: (updater) => {
      setRowSelection((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater
        if (onRowSelectionChange) {
          const selectedRows = data.filter((row) => next[row.id])
          onRowSelectionChange(selectedRows)
        }
        return next
      })
    },
    onColumnVisibilityChange: setColumnVisibility,
  })

  const rows = table.getRowModel().rows
  const canPrev = page > 1
  const canNext = page < pageCount

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 min-w-[200px] max-w-sm">
          {showSearch && (
            <div className="relative w-full">
              <SearchIcon className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder ?? t("searchPlaceholder")}
                className="ps-8 h-9"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ms-auto">
          {toolbarExtra}
          {showColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Columns3Icon data-icon="inline-start" />
                  <span>{t("columns")}</span>
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {table
                  .getAllColumns()
                  .filter(
                    (column) =>
                      typeof column.accessorFn !== "undefined" &&
                      column.getCanHide() &&
                      column.id !== "select" &&
                      column.id !== "actions"
                  )
                  .map((column) => {
                    const headerTitle =
                      typeof column.columnDef.header === "string"
                        ? column.columnDef.header
                        : column.id.replace(/_/g, " ")
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {headerTitle}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : (
                      <FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="**:data-[slot=table-cell]:first:w-8">
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={allColumns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("loading")}
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
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
                <TableCell
                  colSpan={allColumns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage ?? t("noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 text-sm text-muted-foreground">
        <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
          {Object.keys(rowSelection).length > 0
            ? t("rowsSelected", {
                selected: Object.keys(rowSelection).length,
                total: totalCount,
              })
            : t("rowCount", { count: totalCount })}
        </div>
        <div className="flex w-full items-center gap-6 lg:w-fit lg:gap-8 ms-auto">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              {t("rowsPerPage")}
            </Label>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                onPageSizeChange(Number(value))
              }}
            >
              <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            {t("pageOf", { page, pages: pageCount })}
          </div>
          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <Button
              variant="outline"
              className="hidden size-8 lg:flex p-0"
              size="icon"
              onClick={() => onPageChange(1)}
              disabled={!canPrev}
            >
              <span className="sr-only">{t("firstPage")}</span>
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              className="size-8 p-0"
              size="icon"
              onClick={() => onPageChange(page - 1)}
              disabled={!canPrev}
            >
              <span className="sr-only">{t("prevPage")}</span>
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              className="size-8 p-0"
              size="icon"
              onClick={() => onPageChange(page + 1)}
              disabled={!canNext}
            >
              <span className="sr-only">{t("nextPage")}</span>
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex p-0"
              size="icon"
              onClick={() => onPageChange(pageCount)}
              disabled={!canNext}
            >
              <span className="sr-only">{t("lastPage")}</span>
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
