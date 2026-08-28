import "server-only"
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js"

export type { ListParams, PaginatedResponse } from "./list-params-types"

/**
 * Checks if a PostgREST error is a 416 (PGRST103: Requested range not satisfiable).
 * In REST APIs, requesting a page offset beyond the dataset size should return
 * an empty page `{ data: [], total: count }` with HTTP 200 rather than HTTP 500.
 */
export function isRangeError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === "PGRST103" ||
    (typeof error.message === "string" && error.message.toLowerCase().includes("range not satisfiable"))
  )
}

/**
 * Applies search filtering (OR ilike across searchColumns) and range-based
 * pagination to a Supabase query builder.
 *
 * The caller must chain `.select("*", { count: "exact" })` BEFORE calling this,
 * then destructure `{ data, count }` from the result.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyListParams<Q extends PostgrestFilterBuilder<any, any, any, any>>(
  query: Q,
  searchColumns: string[],
  params: import("./list-params-types").ListParams,
): Q {
  const { search, page = 1, pageSize = 10 } = params

  if (search && search.trim() && searchColumns.length > 0) {
    const term = search.trim()
    const orClause = searchColumns.map((col) => `${col}.ilike.%${term}%`).join(",")
    query = query.or(orClause) as Q
  }

  // Deterministic sort: always order by created_at desc so pagination slices strictly without duplicates or shuffling
  query = query.order("created_at", { ascending: false }) as Q

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to) as Q

  return query
}
