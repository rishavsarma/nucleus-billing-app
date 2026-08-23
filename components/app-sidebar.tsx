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

// TODO: hide the "Admin" group unless the signed-in user is a superadmin
// (see requireSuperadmin() in lib/database/require-org.ts / useSuperadmins()).
const navGroups: NavGroup[] = [
  {
    label: "Sales",
    items: [
      { title: "Invoices", url: "/sales/invoices", icon: FileText },
      { title: "Credit Notes", url: "/sales/credit-notes", icon: Undo2 },
      { title: "Payments", url: "/sales/payments", icon: Wallet },
    ],
  },
  {
    label: "Purchases",
    items: [
      { title: "Bills", url: "/purchases/bills", icon: ShoppingCart },
      { title: "Debit Notes", url: "/purchases/debit-notes", icon: Undo2 },
      { title: "Payments", url: "/purchases/payments", icon: Receipt },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Items", url: "/catalog/items", icon: Tag },
      { title: "Tax Rates", url: "/catalog/tax-rates", icon: Percent },
      { title: "Warehouses", url: "/catalog/warehouses", icon: Warehouse },
      { title: "Offers", url: "/catalog/offers", icon: Boxes },
    ],
  },
  {
    label: "Parties",
    items: [
      { title: "Customers", url: "/parties/customers", icon: Users },
      { title: "Vendors", url: "/parties/vendors", icon: Truck },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Stock", url: "/inventory/stock", icon: Boxes },
      { title: "Movements", url: "/inventory/movements", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Organization", url: "/settings/organization", icon: Building2 },
      { title: "Members", url: "/settings/members", icon: UserCog },
    ],
  },
  {
    label: "Admin",
    items: [
      { title: "Organizations", url: "/admin/organizations", icon: Building2 },
      { title: "Superadmins", url: "/admin/superadmins", icon: ShieldCheck },
    ],
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/">
                <LayoutDashboard />
                <span className="font-medium">Dashboard</span>
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
