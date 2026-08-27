import "server-only"
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js"

export type { ListParams, PaginatedResponse } from "./list-params-types"

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

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to) as Q

  return query
}
