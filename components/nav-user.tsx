"use client"

import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { CircleUserRoundIcon, CreditCardIcon, EllipsisVerticalIcon, LogOutIcon, SettingsIcon } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useLogout } from "@/hooks/use-logout"
import { routes } from "@/lib/routes"
import type { Me } from "@/lib/services/me"

function initials(name: string | null, email: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.split("@")[0].slice(0, 2).toUpperCase()
  return "?"
}

export function NavUser({ me }: { me: Me }) {
  const { isMobile } = useSidebar()
  const t = useTranslations("Sidebar")
  const tRoles = useTranslations("Roles")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const logout = useLogout()

  const roleLabel = me.isSuperadmin ? tRoles("superadmin") : me.role ? tRoles(me.role) : null
  const primaryLabel = me.name || me.email || "—"
  const initialsLabel = initials(me.name, me.email)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initialsLabel}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{primaryLabel}</span>
                {roleLabel ? (
                  <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
                ) : null}
              </div>
              <EllipsisVerticalIcon className="ms-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">{initialsLabel}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-medium">{primaryLabel}</span>
                  {me.name && me.email ? (
                    <span className="truncate text-xs text-muted-foreground">{me.email}</span>
                  ) : null}
                  {roleLabel ? (
                    <Badge variant="secondary" className="mt-0.5 w-fit text-xs">
                      {roleLabel}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={routes.settings.profile}>
                <CircleUserRoundIcon />
                {t("items.myProfile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={routes.settings.subscription}>
                <CreditCardIcon />
                {t("items.subscription")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={routes.settings.appSettings}>
                <SettingsIcon />
                {t("items.appSettings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
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
              {t("logOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
