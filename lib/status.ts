// Maps a raw DB status/role string to a semantic color tone. Pure mapping,
// no display text — callers supply the (translated) label separately so this
// stays i18n-agnostic. Add a case here whenever a new status column is wired
// up; unknown values fall back to "neutral" rather than throwing.
export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger"

const TONE_BY_STATUS: Record<string, StatusTone> = {
  draft: "neutral",
  sent: "info",
  received: "info",
  issued: "info",
  pending: "neutral",
  out_for_delivery: "info",
  partially_paid: "warning",
  past_due: "danger",
  trialing: "info",
  paid: "success",
  delivered: "success",
  active: "success",
  overdue: "danger",
  covered: "success",
  failed: "danger",
  cancelled: "neutral",
  void: "neutral",
  expired: "neutral",
  inactive: "neutral",
  upcoming: "info",
  owner: "neutral",
  admin: "info",
  member: "neutral",
  low: "warning",
  ok: "success",
}

export function statusTone(status: string): StatusTone {
  return TONE_BY_STATUS[status] ?? "neutral"
}
