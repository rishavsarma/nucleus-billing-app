import { statusTone } from "@/lib/status"

describe("statusTone", () => {
  it.each([
    ["draft", "neutral"],
    ["sent", "info"],
    ["partially_paid", "warning"],
    ["paid", "success"],
    ["overdue", "danger"],
    ["void", "neutral"],
  ] as const)("maps %s -> %s", (status, tone) => {
    expect(statusTone(status)).toBe(tone)
  })

  it("falls back to neutral for an unrecognized status instead of throwing", () => {
    expect(statusTone("some_future_status_not_in_the_map")).toBe("neutral")
  })

  it("is case-sensitive — a differently-cased known status also falls back to neutral", () => {
    // Documents actual behavior: the map only has lowercase keys, so a
    // caller passing "Draft"/"PAID" silently gets "neutral" rather than an
    // error. Worth knowing since DB status columns are lowercase by
    // convention but nothing enforces that at this function's boundary.
    expect(statusTone("Draft")).toBe("neutral")
  })
})
