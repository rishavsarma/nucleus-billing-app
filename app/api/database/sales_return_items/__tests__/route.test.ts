/**
 * Regression test for the cross-tenant stock-corruption bug fixed this
 * session: POST /api/database/sales_return_items accepted `invoice_item_id`
 * from the request body without verifying it belonged to the caller's own
 * org. A malicious/careless member could point it at another org's
 * invoice_items row; sales_returns_stock_effect() (SECURITY DEFINER,
 * bypasses RLS) would then mutate that other org's item_variants on issue.
 *
 * This test drives the actual route handler (not just the helper function)
 * so a future edit that silently drops the check again fails loudly here.
 */

// Fully replaced (not spread from jest.requireActual): the real module
// imports the shared ioredis client as a module-level side effect, which
// would open a real connection during this test. The route only ever
// touches these three named exports, so a full replacement is safe.
jest.mock("@/lib/database/require-org", () => ({
  requireOrgId: jest.fn(),
  verifyBelongsToOrg: jest.fn(),
  verifyChildBelongsToOrg: jest.fn(),
}))
jest.mock("@/lib/cache", () => ({
  cacheDel: jest.fn().mockResolvedValue(undefined),
  cacheGet: jest.fn().mockResolvedValue(null),
  cacheSet: jest.fn().mockResolvedValue(undefined),
}))

import {
  requireOrgId,
  verifyBelongsToOrg,
  verifyChildBelongsToOrg,
} from "@/lib/database/require-org"
import { POST } from "@/app/api/database/sales_return_items/route"

const mockRequireOrgId = requireOrgId as jest.Mock
const mockVerifyBelongsToOrg = verifyBelongsToOrg as jest.Mock
const mockVerifyChildBelongsToOrg = verifyChildBelongsToOrg as jest.Mock

/** Fake Supabase client covering only what this route's POST touches:
 * the local verifySalesReturnInOrg() lookup on sales_returns, and the
 * final insert on sales_return_items (spied on so tests can assert
 * whether a write was attempted at all). */
function makeFakeSupabase(opts: { salesReturnFound: boolean }) {
  const insert = jest.fn().mockReturnValue({
    select: () => ({
      single: async () => ({ data: { id: "sri-new" }, error: null }),
    }),
  })
  const supabase = {
    schema: () => ({
      from: (table: string) => {
        if (table === "sales_returns") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: opts.salesReturnFound ? { id: "sr-1" } : null,
                    error: null,
                  }),
                }),
                maybeSingle: async () => ({
                  data: opts.salesReturnFound ? { id: "sr-1" } : null,
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "sales_return_items") {
          return { insert }
        }
        throw new Error(`unexpected table in test fake: ${table}`)
      },
    }),
  }
  return { supabase, insert }
}

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/database/sales_return_items", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("POST /api/database/sales_return_items", () => {
  const baseBody = {
    sales_return_id: "sr-1",
    item_id: "item-1",
    invoice_item_id: "ii-cross-org",
    quantity: 2,
  }

  it("rejects and does NOT insert when invoice_item_id belongs to a different org", async () => {
    const { supabase, insert } = makeFakeSupabase({ salesReturnFound: true })
    mockRequireOrgId.mockResolvedValue({
      orgId: "org-A",
      userId: "u1",
      isSuperadmin: false,
      supabase,
    })
    mockVerifyBelongsToOrg.mockResolvedValue(true) // item_id checks out
    mockVerifyChildBelongsToOrg.mockResolvedValue(false) // invoice_item_id does NOT — the fixed case

    const response = await POST(jsonRequest(baseBody))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(
      /invoice_item_id does not belong to this org/i
    )
    // The critical assertion: no row was ever written once the FK check failed.
    expect(insert).not.toHaveBeenCalled()
  })

  it("passes the correct child/parent table pair to verifyChildBelongsToOrg", async () => {
    const { supabase } = makeFakeSupabase({ salesReturnFound: true })
    mockRequireOrgId.mockResolvedValue({
      orgId: "org-A",
      userId: "u1",
      isSuperadmin: false,
      supabase,
    })
    mockVerifyBelongsToOrg.mockResolvedValue(true)
    mockVerifyChildBelongsToOrg.mockResolvedValue(true)

    await POST(jsonRequest(baseBody))

    expect(mockVerifyChildBelongsToOrg).toHaveBeenCalledWith(
      supabase,
      "invoice_items",
      "ii-cross-org",
      "invoice_id",
      "invoices",
      "org-A",
      false
    )
  })

  it("creates the line item once every FK check passes", async () => {
    const { supabase, insert } = makeFakeSupabase({ salesReturnFound: true })
    mockRequireOrgId.mockResolvedValue({
      orgId: "org-A",
      userId: "u1",
      isSuperadmin: false,
      supabase,
    })
    mockVerifyBelongsToOrg.mockResolvedValue(true)
    mockVerifyChildBelongsToOrg.mockResolvedValue(true)

    const response = await POST(jsonRequest(baseBody))

    expect(response.status).toBe(201)
    expect(insert).toHaveBeenCalledWith(baseBody)
  })

  it("skips the invoice_item_id check entirely when the field is absent (not every return line traces to an invoice line)", async () => {
    const { supabase } = makeFakeSupabase({ salesReturnFound: true })
    mockRequireOrgId.mockResolvedValue({
      orgId: "org-A",
      userId: "u1",
      isSuperadmin: false,
      supabase,
    })
    mockVerifyBelongsToOrg.mockResolvedValue(true)

    const bodyWithoutInvoiceItem = {
      sales_return_id: "sr-1",
      item_id: "item-1",
      quantity: 2,
    }
    const response = await POST(jsonRequest(bodyWithoutInvoiceItem))

    expect(mockVerifyChildBelongsToOrg).not.toHaveBeenCalled()
    expect(response.status).toBe(201)
  })
})
