import { AppSidebar } from "@/components/app-sidebar"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ModeToggle } from "@/components/mode-toggle"
import { ThemePresetSelector } from "@/components/theme-preset-selector"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

// Auth is enforced in proxy.ts (unauthenticated requests to any of
// these routes are redirected to /login before this layout ever renders),
// so this layout only needs to build the shell.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider >
      <AppSidebar variant="inset"/>
      <SidebarInset >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Breadcrumbs />
          <div className="flex-1" />
          <ThemePresetSelector />
          <ModeToggle />
          <LanguageSwitcher /> 
        </header>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
