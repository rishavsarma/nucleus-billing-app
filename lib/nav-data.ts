import {
  ArrowLeftRight,
  Boxes,
  Building2,
  CreditCard,
  FileText,
  Percent,
  Puzzle,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Truck,
  Undo2,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  Zap,
  type LucideIcon,
} from "lucide-react"

export type NavItemData = {
  /** Key under Sidebar.items in messages/*.json */
  titleKey: string
  url: string
  icon: LucideIcon
}

export type NavGroupData = {
  /** Key under Sidebar.groups in messages/*.json */
  labelKey: string
  items: NavItemData[]
}

// Single source of truth for both AppSidebar's nav and the header's
// breadcrumb — keeps the two from drifting out of sync.
export const NAV_DATA: NavGroupData[] = [
  {
    labelKey: "dashboard",
    items: [
      { titleKey: "overview", url: "/dashboard/overview", icon: Wallet },
      { titleKey: "reports", url: "/dashboard/reports", icon: FileText },
      { titleKey: "analysis", url: "/dashboard/analysis", icon: Undo2 },
    ],
  },
  {
    labelKey: "sales",
    items: [
      { titleKey: "billing", url: "/sales/billing", icon: Zap },
      { titleKey: "invoices", url: "/sales/invoices", icon: FileText },
      { titleKey: "creditNotes", url: "/sales/credit-notes", icon: Undo2 },
      { titleKey: "payments", url: "/sales/payments", icon: Wallet },
    ],
  },
  {
    labelKey: "purchases",
    items: [
      { titleKey: "bills", url: "/purchases/bills", icon: ShoppingCart },
      { titleKey: "debitNotes", url: "/purchases/debit-notes", icon: Undo2 },
      { titleKey: "payments", url: "/purchases/payments", icon: Receipt },
    ],
  },
  {
    labelKey: "catalog",
    items: [
      { titleKey: "items", url: "/catalog/items", icon: Tag },
      { titleKey: "taxRates", url: "/catalog/tax-rates", icon: Percent },
      { titleKey: "warehouses", url: "/catalog/warehouses", icon: Warehouse },
      { titleKey: "offers", url: "/catalog/offers", icon: Boxes },
    ],
  },
  {
    labelKey: "parties",
    items: [
      { titleKey: "customers", url: "/parties/customers", icon: Users },
      { titleKey: "vendors", url: "/parties/vendors", icon: Truck },
    ],
  },
  {
    labelKey: "inventory",
    items: [
      { titleKey: "stock", url: "/inventory/stock", icon: Boxes },
      { titleKey: "movements", url: "/inventory/movements", icon: ArrowLeftRight },
    ],
  },
  {
    labelKey: "settings",
    items: [
      { titleKey: "organization", url: "/settings/organization", icon: Building2 },
      { titleKey: "members", url: "/settings/members", icon: UserCog },
      { titleKey: "subscription", url: "/settings/subscription", icon: CreditCard },
      { titleKey: "addons", url: "/settings/addons", icon: Puzzle },
      { titleKey: "appSettings", url: "/settings/app-settings", icon: Settings },
    ],
  },
  {
    labelKey: "admin",
    items: [
      { titleKey: "organizations", url: "/admin/organizations", icon: Building2 },
      { titleKey: "superadmins", url: "/admin/superadmins", icon: ShieldCheck },
    ],
  },
]

/** Finds the nav group/item whose url is the longest prefix match of `pathname`
 * (so a detail page like /parties/customers/<id> still resolves to "Customers"). */
export function matchNavEntry(pathname: string): { group: NavGroupData; item: NavItemData } | null {
  let best: { group: NavGroupData; item: NavItemData } | null = null
  for (const group of NAV_DATA) {
    for (const item of group.items) {
      if (pathname === item.url || pathname.startsWith(item.url + "/")) {
        if (!best || item.url.length > best.item.url.length) {
          best = { group, item }
        }
      }
    }
  }
  return best
}
