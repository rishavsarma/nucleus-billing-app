"use client"

import {
  ArrowLeftRight,
  Boxes,
  Building2,
  FileText,
  LayoutDashboard,
  Percent,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Truck,
  Undo2,
  UserCog,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Link, usePathname } from "@/i18n/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

type NavGroup = {
  label: string
  items: NavItem[]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const t = useTranslations("Sidebar")

  // TODO: hide the "Admin" group unless the signed-in user is a superadmin
  // (see requireSuperadmin() in lib/database/require-org.ts / useSuperadmins()).
  const navGroups: NavGroup[] = [
    {
      label: t("groups.dashboard"),
      items: [
        { title: t("items.overview"), url: "/dashboard/overview", icon: Wallet },
        { title: t("items.reports"), url: "/dashboard/reports", icon: FileText },
        { title: t("items.analysis"), url: "/dashboard/analysis", icon: Undo2 },
      ],
    },
    {
      label: t("groups.sales"),
      items: [
        { title: t("items.invoices"), url: "/sales/invoices", icon: FileText },
        { title: t("items.creditNotes"), url: "/sales/credit-notes", icon: Undo2 },
        { title: t("items.payments"), url: "/sales/payments", icon: Wallet },
      ],
    },
    {
      label: t("groups.purchases"),
      items: [
        { title: t("items.bills"), url: "/purchases/bills", icon: ShoppingCart },
        { title: t("items.debitNotes"), url: "/purchases/debit-notes", icon: Undo2 },
        { title: t("items.payments"), url: "/purchases/payments", icon: Receipt },
      ],
    },
    {
      label: t("groups.catalog"),
      items: [
        { title: t("items.items"), url: "/catalog/items", icon: Tag },
        { title: t("items.taxRates"), url: "/catalog/tax-rates", icon: Percent },
        { title: t("items.warehouses"), url: "/catalog/warehouses", icon: Warehouse },
        { title: t("items.offers"), url: "/catalog/offers", icon: Boxes },
      ],
    },
    {
      label: t("groups.parties"),
      items: [
        { title: t("items.customers"), url: "/parties/customers", icon: Users },
        { title: t("items.vendors"), url: "/parties/vendors", icon: Truck },
      ],
    },
    {
      label: t("groups.inventory"),
      items: [
        { title: t("items.stock"), url: "/inventory/stock", icon: Boxes },
        { title: t("items.movements"), url: "/inventory/movements", icon: ArrowLeftRight },
      ],
    },
    {
      label: t("groups.settings"),
      items: [
        { title: t("items.organization"), url: "/settings/organization", icon: Building2 },
        { title: t("items.members"), url: "/settings/members", icon: UserCog },
      ],
    },
    {
      label: t("groups.admin"),
      items: [
        { title: t("items.organizations"), url: "/admin/organizations", icon: Building2 },
        { title: t("items.superadmins"), url: "/admin/superadmins", icon: ShieldCheck },
      ],
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/">
                <LayoutDashboard />
                <span className="font-medium">{t("brand")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={pathname === item.url}>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
