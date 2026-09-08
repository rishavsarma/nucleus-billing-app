// require-org.ts imports the shared ioredis client (for its auth cache) as
// a module-level side effect — mock it so importing the module under test
// never opens a real connection, even though neither function tested here
// touches Redis directly.
jest.mock("@/lib/redis", () => ({ redis: { get: jest.fn(), set: jest.fn() } }))

import {
  verifyBelongsToOrg,
  verifyChildBelongsToOrg,
  type SupabaseClient,
} from "@/lib/database/require-org"

/**
 * Minimal fake modeling the exact query chain both functions issue:
 * .schema("billing").from(table).select(cols).eq(col, val)[.eq(...)].maybeSingle()
 *
 * `tables` maps table name -> rows. A row "matches" a query when every
 * .eq() filter applied to the chain equals that row's value for that
 * column — same semantics as a real Postgres equality filter.
 */
function fakeSupabase(
  tables: Record<string, Record<string, unknown>[]>
): SupabaseClient {
  const client = {
    schema: () => ({
      from: (table: string) => {
        const rows = tables[table] ?? []
        const filters: Record<string, unknown> = {}
        const builder = {
          select: () => builder,
          eq: (col: string, val: unknown) => {
            filters[col] = val
            return builder
          },
          maybeSingle: async () => {
            const match = rows.find((row) =>
              Object.entries(filters).every(([k, v]) => row[k] === v)
            )
            return { data: match ?? null, error: null }
          },
        }
        return builder
      },
    }),
  }
  return client as unknown as SupabaseClient
}

describe("verifyBelongsToOrg", () => {
  const supabase = fakeSupabase({
    customers: [
      { id: "cust-1", org_id: "org-A" },
      { id: "cust-2", org_id: "org-B" },
    ],
  })

  it("returns true when the row exists and belongs to the caller's org", async () => {
    expect(
      await verifyBelongsToOrg(supabase, "customers", "cust-1", "org-A", false)
    ).toBe(true)
  })

  it("returns false when the row exists but belongs to a different org — the exact fix this session applied", async () => {
    // This is precisely the case that was missing on sales_return_items /
    // purchase_return_items before the fix: an id that resolves to a real
    // row, just in someone else's org.
    expect(
      await verifyBelongsToOrg(supabase, "customers", "cust-2", "org-A", false)
    ).toBe(false)
  })

  it("returns false when the id doesn't exist at all", async () => {
    expect(
      await verifyBelongsToOrg(
        supabase,
        "customers",
        "does-not-exist",
        "org-A",
        false
      )
    ).toBe(false)
  })

  it("skips the org filter entirely for a superadmin, regardless of the row's actual org", async () => {
    expect(
      await verifyBelongsToOrg(supabase, "customers", "cust-2", "org-A", true)
    ).toBe(true)
  })

  it("returns false for a superadmin too when the id simply doesn't exist", async () => {
    expect(
      await verifyBelongsToOrg(supabase, "customers", "nope", "org-A", true)
    ).toBe(false)
  })
})

describe("verifyChildBelongsToOrg", () => {
  // Models invoice_items (no org_id of its own) -> invoices (has org_id) —
  // the exact shape used for sales_return_items.invoice_item_id and
  // purchase_return_items.purchase_bill_item_id.
  const supabase = fakeSupabase({
    invoice_items: [
      { id: "ii-1", invoice_id: "inv-1" },
      { id: "ii-2", invoice_id: "inv-2" },
    ],
    invoices: [
      { id: "inv-1", org_id: "org-A" },
      { id: "inv-2", org_id: "org-B" },
    ],
  })

  it("returns true when the child's parent belongs to the caller's org", async () => {
    const ok = await verifyChildBelongsToOrg(
      supabase,
      "invoice_items",
      "ii-1",
      "invoice_id",
      "invoices",
      "org-A",
      false
    )
    expect(ok).toBe(true)
  })

  it("returns false when the child's parent belongs to a different org — the cross-tenant case this fix closes", async () => {
    // ii-2 is a real invoice_items row, but it points at inv-2, which
    // belongs to org-B. A caller in org-A supplying ii-2 as
    // invoice_item_id must be rejected — before the fix, sales_return_items
    // never ran this check at all and would have inserted it.
    const ok = await verifyChildBelongsToOrg(
      supabase,
      "invoice_items",
      "ii-2",
      "invoice_id",
      "invoices",
      "org-A",
      false
    )
    expect(ok).toBe(false)
  })

  it("returns false when the child row itself doesn't exist", async () => {
    const ok = await verifyChildBelongsToOrg(
      supabase,
      "invoice_items",
      "ghost",
      "invoice_id",
      "invoices",
      "org-A",
      false
    )
    expect(ok).toBe(false)
  })

  it("still resolves the real parent for a superadmin (bypassing only the final org check, not the lookup)", async () => {
    const ok = await verifyChildBelongsToOrg(
      supabase,
      "invoice_items",
      "ii-2",
      "invoice_id",
      "invoices",
      "org-A",
      true
    )
    expect(ok).toBe(true)
  })
})
