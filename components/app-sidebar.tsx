"use client"

import { LayoutDashboard } from "lucide-react"
import { useTranslations } from "next-intl"

import { Link, usePathname } from "@/i18n/navigation"
import { NavUser } from "@/components/nav-user"
import { useMe } from "@/hooks/use-me"
import { useOrganizations } from "@/hooks/use-organizations"
import { NAV_DATA } from "@/lib/nav-data"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const t = useTranslations("Sidebar")
  const { data: me } = useMe()
  const { data: organizations } = useOrganizations()
  const organization = organizations?.[0]

  const navGroups = NAV_DATA.filter((group) => group.labelKey !== "admin" || me?.isSuperadmin).map(
    (group) => ({
      label: t(`groups.${group.labelKey}`),
      items: group.items.map((item) => ({
        title: t(`items.${item.titleKey}`),
        url: item.url,
        icon: item.icon,
      })),
    }),
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/">
                {organization?.pdf_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- store logo is an arbitrary external URL, not a local/optimizable asset
                  <img
                    src={organization.pdf_logo_url}
                    alt={organization.name}
                    className="size-4 shrink-0 rounded-sm object-contain"
                  />
                ) : (
                  <LayoutDashboard />
                )}
                <span className="truncate font-medium">{organization?.name ?? t("brand")}</span>
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
                    <SidebarMenuButton className="my-0.5" asChild isActive={pathname === item.url}>
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
      <SidebarFooter>{me ? <NavUser me={me} /> : null}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
