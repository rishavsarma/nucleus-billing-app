"use client"

import * as React from "react"
import { createColumnHelper } from "@tanstack/react-table"
import { tableFeatures, columnVisibilityFeature, rowPaginationFeature, rowSelectionFeature } from "@tanstack/react-table"

import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { EntityTable, type EntityTableProps } from "@/components/entity-table"
import type { PaginatedResponse } from "@/lib/database/list-params-types"

// We re-export the column helper feature set so page-level column defs compile correctly
const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
})

type OmitControlled<T extends { id: string }> = Omit<
  EntityTableProps<T>,
  | "totalCount"
  | "page"
  | "pageSize"
  | "onPageChange"
  | "onPageSizeChange"
  | "search"
  | "onSearchChange"
>

export type ServerTableProps<TData extends { id: string }> = OmitControlled<TData> & {
  /** Result from a `useXList(params)` hook — already paginated by the server. */
  result: PaginatedResponse<TData> | undefined
  isLoading: boolean
  /** Default page size (default: 10). */
  defaultPageSize?: number
}

/**
 * Owns search/page/pageSize state and debounce, wires them to EntityTable.
 * Pass the hook result directly; ServerTable handles re-fetching by driving params.
 *
 * Usage in a list page:
 * ```tsx
 * const [params, setParams] = useServerTableParams()
 * const { data: result, isLoading } = useInvoicesList(params)
 *
 * <ServerTable columns={columns} result={result} isLoading={isLoading} />
 * ```
 * Or use the built-in state management:
 * ```tsx
 * <ServerTable columns={columns} result={result} isLoading={isLoading} />
 * ```
 */
export function ServerTable<TData extends { id: string }>({
  result,
  isLoading,
  defaultPageSize = 10,
  ...tableProps
}: ServerTableProps<TData>) {
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(defaultPageSize)

  // Expose current params via ref so parent can read them if needed
  const debouncedSearch = useDebouncedValue(search, 300)

  // When debounced search changes, reset to page 1
  React.useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  return (
    <EntityTable
      {...tableProps}
      data={result?.data ?? []}
      isLoading={isLoading}
      totalCount={result?.total ?? 0}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={(size) => {
        setPageSize(size)
        setPage(1)
      }}
      search={search}
      onSearchChange={setSearch}
    />
  )
}

/**
 * Hook that owns the server-table state and returns both the current params
 * (to pass to your data hook) and handlers (to pass to ServerTable).
 * Use when the parent component needs to read or control search/page/pageSize.
 */
export function useServerTableParams(defaultPageSize = 10) {
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(defaultPageSize)
  const debouncedSearch = useDebouncedValue(search, 300)

  React.useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const params = React.useMemo(
    () => ({ search: debouncedSearch || undefined, page, pageSize }),
    [debouncedSearch, page, pageSize],
  )

  const tableControlProps = {
    search,
    onSearchChange: setSearch,
    page,
    onPageChange: setPage,
    pageSize,
    onPageSizeChange: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }

  return { params, tableControlProps }
}
