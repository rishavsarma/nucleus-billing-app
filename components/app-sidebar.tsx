"use client"

import { LayoutDashboard, LogOutIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Link, usePathname, useRouter } from "@/i18n/navigation"
import { useLogout } from "@/hooks/use-logout"
import { useMe } from "@/hooks/use-me"
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
  const router = useRouter()
  const t = useTranslations("Sidebar")
  const tCommon = useTranslations("Common")
  const { data: me } = useMe()
  const logout = useLogout()

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
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() =>
                logout.mutate(undefined, {
                  onSuccess: () => {
                    router.push("/login")
                    router.refresh()
                  },
                  onError: () => toast.error(tCommon("genericError")),
                })
              }
              disabled={logout.isPending}
            >
              <LogOutIcon />
              <span>{t("logOut")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
