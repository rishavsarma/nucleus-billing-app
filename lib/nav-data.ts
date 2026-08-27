import {
  ArrowLeftRight,
  Boxes,
  Building2,
  CalendarClock,
  CreditCard,
  FileText,
  PackageX,
  Percent,
  Puzzle,
  Receipt,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Stamp,
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

import { routes } from "@/lib/routes"

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
      { titleKey: "overview", url: routes.dashboard.overview, icon: Wallet },
      { titleKey: "reports", url: routes.dashboard.reports, icon: FileText },
      { titleKey: "analysis", url: routes.dashboard.analysis, icon: Undo2 },
    ],
  },
  {
    labelKey: "sales",
    items: [
      { titleKey: "billing", url: routes.sales.billing, icon: Zap },
      { titleKey: "invoices", url: routes.sales.invoices.list, icon: FileText },
      { titleKey: "creditNotes", url: routes.sales.creditNotes.list, icon: Undo2 },
      { titleKey: "salesReturns", url: routes.sales.salesReturns.list, icon: PackageX },
      { titleKey: "payments", url: routes.sales.payments, icon: Wallet },
      { titleKey: "installments", url: routes.sales.installments, icon: CalendarClock },
    ],
  },
  {
    labelKey: "purchases",
    items: [
      { titleKey: "bills", url: routes.purchases.bills.list, icon: ShoppingCart },
      { titleKey: "debitNotes", url: routes.purchases.debitNotes.list, icon: Undo2 },
      { titleKey: "purchaseReturns", url: routes.purchases.purchaseReturns.list, icon: PackageX },
      { titleKey: "payments", url: routes.purchases.payments, icon: Receipt },
    ],
  },
  {
    labelKey: "catalog",
    items: [
      { titleKey: "items", url: routes.catalog.items.list, icon: Tag },
      { titleKey: "taxRates", url: routes.catalog.taxRates, icon: Percent },
      { titleKey: "warehouses", url: routes.catalog.warehouses, icon: Warehouse },
      { titleKey: "deliveryPersons", url: routes.catalog.deliveryPersons, icon: Truck },
      { titleKey: "offers", url: routes.catalog.offers.list, icon: Boxes },
    ],
  },
  {
    labelKey: "parties",
    items: [
      { titleKey: "customers", url: routes.parties.customers.list, icon: Users },
      { titleKey: "vendors", url: routes.parties.vendors.list, icon: Truck },
    ],
  },
  {
    labelKey: "inventory",
    items: [
      { titleKey: "stock", url: routes.inventory.stock, icon: Boxes },
      { titleKey: "movements", url: routes.inventory.movements.list, icon: ArrowLeftRight },
    ],
  },
  {
    labelKey: "settings",
    items: [
      { titleKey: "organization", url: routes.settings.organization, icon: Building2 },
      { titleKey: "members", url: routes.settings.members, icon: UserCog },
      { titleKey: "subscription", url: routes.settings.subscription, icon: CreditCard },
      { titleKey: "addons", url: routes.settings.addons, icon: Puzzle },
      { titleKey: "pdfWatermarks", url: routes.settings.pdfWatermarks, icon: Stamp },
      { titleKey: "appSettings", url: routes.settings.appSettings, icon: Settings },
    ],
  },
  {
    labelKey: "admin",
    items: [
      { titleKey: "organizations", url: routes.admin.organizations.list, icon: Building2 },
      { titleKey: "superadmins", url: routes.admin.superadmins, icon: ShieldCheck },
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
