"use client"

import * as React from "react"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { EntityTable, type EntityTableProps } from "@/components/entity-table"
import type { PaginatedResponse } from "@/lib/database/list-params-types"

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

  const handleSearchChange = React.useCallback((val: string) => {
    setSearch(val)
    setPage(1)
  }, [])

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
      onSearchChange={handleSearchChange}
    />
  )
}

/**
 * Hook that owns the server-table state and returns both the current params
 * (to pass to your data hook) and handlers (to pass to ServerTable / EntityTable).
 * Use when the parent component needs to read or control search/page/pageSize.
 */
export function useServerTableParams(defaultPageSize = 10) {
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(defaultPageSize)
  const debouncedSearch = useDebouncedValue(search, 300)

  const handleSearchChange = React.useCallback((val: string) => {
    setSearch(val)
    setPage(1)
  }, [])

  const params = React.useMemo(
    () => ({ search: debouncedSearch || undefined, page, pageSize }),
    [debouncedSearch, page, pageSize],
  )

  const tableControlProps = {
    search,
    onSearchChange: handleSearchChange,
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
