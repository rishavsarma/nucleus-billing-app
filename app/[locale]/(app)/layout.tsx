import { AppSidebar } from "@/components/app-sidebar"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ThemePresetSelector } from "@/components/theme-preset-selector"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

// Auth is enforced in middleware.ts (unauthenticated requests to any of
// these routes are redirected to /login before this layout ever renders),
// so this layout only needs to build the shell.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4!" />
          <div className="flex-1" />
          <ThemePresetSelector />
          <LanguageSwitcher />
        </header>
        <div className="flex-1 p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
