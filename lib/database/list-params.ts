import "server-only"
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js"

export type { ListParams, PaginatedResponse } from "./list-params-types"

/**
 * Checks if a PostgREST error is a 416 (PGRST103: Requested range not satisfiable).
 * In REST APIs, requesting a page offset beyond the dataset size should return
 * an empty page `{ data: [], total: count }` with HTTP 200 rather than HTTP 500.
 */
export function isRangeError(
  error: { message?: string; code?: string } | null | undefined
): boolean {
  if (!error) return false
  return (
    error.code === "PGRST103" ||
    (typeof error.message === "string" &&
      error.message.toLowerCase().includes("range not satisfiable"))
  )
}

/** Hard ceiling on rows per request. Without it, `?pageSize=1000000` asks both
 * Postgres and this process to materialise a million rows (audit NB-06). */
export const MAX_PAGE_SIZE = 100

/**
 * Escapes a user-supplied search term for safe use inside a PostgREST filter
 * string (audit NB-03).
 *
 * PostgREST's `or=(...)` grammar is structural: `,` separates conditions, `.`
 * separates column/operator/value, and `()` groups. Interpolating a raw term
 * let a caller inject arbitrary conditions and enumerate the schema through
 * error messages — e.g. a term of `x%,nonexistent_col.ilike.%x` came back as
 * `column customers.nonexistent_col does not exist`.
 *
 * PostgREST treats a double-quoted value as a literal, so wrapping the term in
 * quotes neutralises `,` `.` and `()`. Backslashes and embedded double quotes
 * are escaped first so the quoting itself can't be broken out of.
 */
export function escapeFilterValue(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/**
 * Applies search filtering (OR ilike across searchColumns) and range-based
 * pagination to a Supabase query builder.
 *
 * The caller must chain `.select("*", { count: "exact" })` BEFORE calling this,
 * then destructure `{ data, count }` from the result.
 */
export function applyListParams<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Q extends PostgrestFilterBuilder<any, any, any, any>,
>(
  query: Q,
  searchColumns: string[],
  params: import("./list-params-types").ListParams
): Q {
  const { search } = params

  // Coerce and clamp: a non-numeric ?page/?pageSize previously produced
  // range(NaN, NaN), and neither had an upper bound.
  const rawPage = Number(params.page)
  const rawPageSize = Number(params.pageSize)
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
  const pageSize = Number.isFinite(rawPageSize)
    ? Math.min(Math.max(1, Math.floor(rawPageSize)), MAX_PAGE_SIZE)
    : 10

  if (search && search.trim() && searchColumns.length > 0) {
    const term = escapeFilterValue(search.trim())
    const orClause = searchColumns
      .map((col) => `${col}.ilike."%${term}%"`)
      .join(",")
    query = query.or(orClause) as Q
  }

  // Deterministic sort: always order by created_at desc so pagination slices strictly without duplicates or shuffling
  query = query.order("created_at", { ascending: false }) as Q

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to) as Q

  return query
}
