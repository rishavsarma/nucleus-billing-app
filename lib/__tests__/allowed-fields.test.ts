import {
  ALLOWED_FIELDS,
  ORG_SUPERADMIN_FIELDS,
  pickAllowed,
} from "@/lib/database/allowed-fields"

describe("pickAllowed", () => {
  it("keeps allow-listed fields and drops everything else", () => {
    const result = pickAllowed("customers", {
      name: "Acme",
      email: "a@b.com",
      org_id: "other-org",
      id: "forged-id",
      created_by: "someone-else",
    })
    expect(result).toEqual({ name: "Acme", email: "a@b.com" })
  })

  it("strips the trigger-derived money columns from an invoice update (NB-01)", () => {
    const result = pickAllowed("invoices", {
      notes: "ok",
      status: "sent",
      total: 1,
      amount_paid: 999999,
      subtotal: 0,
      tax_total: 0,
      discount_total: 0,
      round_off_amount: -5,
      invoice_number: "INV-FORGED",
    })
    expect(result).toEqual({ notes: "ok", status: "sent" })
  })

  it("strips derived line totals but keeps the inputs they're computed from", () => {
    const result = pickAllowed("invoice_items", {
      quantity: 2,
      unit_price: 100,
      tax_rate: 18,
      line_subtotal: 1,
      line_tax: 1,
      line_total: 1,
    })
    expect(result).toEqual({ quantity: 2, unit_price: 100, tax_rate: 18 })
  })

  it("keeps the vendor's own invoice number but not our generated bill number", () => {
    const result = pickAllowed("purchase_bills", {
      vendor_invoice_number: "V-123",
      bill_number: "BILL-FORGED",
    })
    expect(result).toEqual({ vendor_invoice_number: "V-123" })
  })

  it("drops subscription/activation fields from an organizations payload", () => {
    const result = pickAllowed("organizations", {
      name: "Acme",
      is_active: true,
      subscription_status: "active",
      subscription_current_period_end: "2099-01-01",
    })
    expect(result).toEqual({ name: "Acme" })
  })

  it("drops installment fields owned by installments_mark_paid()", () => {
    const result = pickAllowed("installments", {
      amount: 500,
      payment_id: "x",
      paid_at: "2026-01-01",
    })
    expect(result).toEqual({ amount: 500 })
  })

  it("keeps installment_id on payments so the route can verify it (NB-02)", () => {
    // The allow-list must NOT drop it — the route verifies it belongs to the
    // org and the DB trigger is org-scoped; dropping it would silently break
    // installment settlement instead.
    expect(ALLOWED_FIELDS.payments).toContain("installment_id")
  })

  it("drops stock-movement columns written by the document triggers", () => {
    const result = pickAllowed("stock_movements", {
      item_id: "i",
      warehouse_id: "w",
      quantity_delta: 5,
      movement_type: "sale",
      reference_type: "invoice",
      reference_id: "r",
      invoice_item_id: "ii",
    })
    expect(result).toEqual({
      item_id: "i",
      warehouse_id: "w",
      quantity_delta: 5,
    })
  })

  it("returns an empty object for non-object bodies", () => {
    expect(pickAllowed("customers", null)).toEqual({})
    expect(pickAllowed("customers", "nope")).toEqual({})
    expect(pickAllowed("customers", [{ name: "x" }])).toEqual({})
  })

  it("does not invent keys that weren't present in the body", () => {
    const result = pickAllowed("customers", { name: "Acme" })
    expect(Object.keys(result)).toEqual(["name"])
    expect("email" in result).toBe(false)
  })

  it("ignores inherited properties from the prototype chain", () => {
    const body = Object.create({ name: "inherited" })
    expect(pickAllowed("customers", body)).toEqual({})
  })

  it("no allow-list exposes an identity or audit column", () => {
    const forbidden = ["id", "org_id", "created_at", "updated_at", "created_by"]
    for (const [entity, fields] of Object.entries(ALLOWED_FIELDS)) {
      for (const f of forbidden) {
        expect({
          entity,
          field: f,
          present: (fields as readonly string[]).includes(f),
        }).toEqual({
          entity,
          field: f,
          present: false,
        })
      }
    }
  })

  it("no allow-list exposes a derived money column", () => {
    const derived = [
      "subtotal",
      "tax_total",
      "discount_total",
      "total",
      "amount_paid",
      "round_off_amount",
      "line_subtotal",
      "line_tax",
      "line_total",
      "quantity_on_hand",
      "quantity_remaining",
    ]
    for (const [entity, fields] of Object.entries(ALLOWED_FIELDS)) {
      for (const f of derived) {
        expect({
          entity,
          field: f,
          present: (fields as readonly string[]).includes(f),
        }).toEqual({
          entity,
          field: f,
          present: false,
        })
      }
    }
  })

  it("no allow-list exposes a document number assigned by an assign_*_number trigger", () => {
    // Named explicitly rather than matched on a "_number" suffix: several
    // legitimately client-settable fields also end in _number
    // (vendor_invoice_number is the vendor's own reference,
    // account_number is a bank account, installment_number is an ordinal).
    const triggerAssigned = [
      "invoice_number",
      "bill_number",
      "credit_note_number",
      "debit_note_number",
      "sales_return_number",
      "purchase_return_number",
    ]
    for (const [entity, fields] of Object.entries(ALLOWED_FIELDS)) {
      const leaked = (fields as readonly string[]).filter((f) =>
        triggerAssigned.includes(f)
      )
      expect({ entity, leaked }).toEqual({ entity, leaked: [] })
    }
  })

  it("organizations allow-list and the superadmin-only list are disjoint", () => {
    for (const f of ORG_SUPERADMIN_FIELDS) {
      expect(
        (ALLOWED_FIELDS.organizations as readonly string[]).includes(f)
      ).toBe(false)
    }
  })
})
