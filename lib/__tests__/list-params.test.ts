import {
  applyListParams,
  escapeFilterValue,
  MAX_PAGE_SIZE,
} from "@/lib/database/list-params"

/** Minimal stand-in for a PostgrestFilterBuilder that records what was called. */
function makeQuery() {
  const calls: { or: string[]; range: [number, number][]; order: string[] } = {
    or: [],
    range: [],
    order: [],
  }
  const q = {
    or(clause: string) {
      calls.or.push(clause)
      return q
    },
    order(col: string) {
      calls.order.push(col)
      return q
    },
    range(from: number, to: number) {
      calls.range.push([from, to])
      return q
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { q: q as any, calls }
}

describe("escapeFilterValue", () => {
  it("escapes double quotes so the wrapping quotes can't be broken out of", () => {
    expect(escapeFilterValue('a"b')).toBe('a\\"b')
  })

  it("escapes backslashes before quotes", () => {
    expect(escapeFilterValue("a\\b")).toBe("a\\\\b")
    expect(escapeFilterValue('a\\"b')).toBe('a\\\\\\"b')
  })

  it("leaves ordinary terms untouched", () => {
    expect(escapeFilterValue("acme corp")).toBe("acme corp")
  })

  it("does not strip PostgREST syntax characters — quoting neutralises them", () => {
    // These stay in the value; wrapping in double quotes is what makes them
    // literal rather than structural.
    expect(escapeFilterValue("x,y.z()")).toBe("x,y.z()")
  })
})

describe("applyListParams — search injection (NB-03)", () => {
  it("wraps the search term in double quotes", () => {
    const { q, calls } = makeQuery()
    applyListParams(q, ["name", "email"], { search: "bob" })
    expect(calls.or[0]).toBe('name.ilike."%bob%",email.ilike."%bob%"')
  })

  it("neutralises an injected filter condition", () => {
    const { q, calls } = makeQuery()
    applyListParams(q, ["name"], { search: "x%,nonexistent_col.ilike.%x" })
    // The injected text stays inside the quoted literal instead of becoming
    // a second condition naming another column.
    expect(calls.or[0]).toBe('name.ilike."%x%,nonexistent_col.ilike.%x%"')
    expect(calls.or[0].split(",").length).toBeGreaterThan(1) // comma is present…
    expect(calls.or[0]).toContain('"') // …but inside quotes
  })

  it("escapes a term that tries to close the quote", () => {
    const { q, calls } = makeQuery()
    applyListParams(q, ["name"], { search: '" ,id.not.is.null,"' })
    expect(calls.or[0]).toBe('name.ilike."%\\" ,id.not.is.null,\\"%"')
  })

  it("skips the filter entirely for an empty or whitespace-only term", () => {
    const { q, calls } = makeQuery()
    applyListParams(q, ["name"], { search: "   " })
    expect(calls.or).toHaveLength(0)
  })
})

describe("applyListParams — pagination bounds (NB-06)", () => {
  it("applies the requested page window", () => {
    const { q, calls } = makeQuery()
    applyListParams(q, [], { page: 3, pageSize: 10 })
    expect(calls.range[0]).toEqual([20, 29])
  })

  it("clamps an oversized pageSize to MAX_PAGE_SIZE", () => {
    const { q, calls } = makeQuery()
    applyListParams(q, [], { page: 1, pageSize: 1_000_000 })
    expect(calls.range[0]).toEqual([0, MAX_PAGE_SIZE - 1])
  })

  it("falls back to defaults for non-numeric input instead of producing NaN", () => {
    const { q, calls } = makeQuery()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applyListParams(q, [], { page: "abc" as any, pageSize: "xyz" as any })
    expect(calls.range[0]).toEqual([0, 9])
    expect(calls.range[0].every(Number.isFinite)).toBe(true)
  })

  it("floors a page below 1 up to 1, so range never goes negative", () => {
    const { q, calls } = makeQuery()
    applyListParams(q, [], { page: 0, pageSize: 10 })
    expect(calls.range[0]).toEqual([0, 9])
    const second = makeQuery()
    applyListParams(second.q, [], { page: -5, pageSize: 10 })
    expect(second.calls.range[0]).toEqual([0, 9])
  })

  it("clamps a pageSize below 1 up to 1", () => {
    const { q, calls } = makeQuery()
    applyListParams(q, [], { page: 1, pageSize: 0 })
    expect(calls.range[0]).toEqual([0, 0])
  })

  it("always orders deterministically so pages don't shuffle", () => {
    const { q, calls } = makeQuery()
    applyListParams(q, [], {})
    expect(calls.order).toEqual(["created_at"])
  })
})
