import { redirect } from "@/i18n/navigation"
import { requireSuperadmin } from "@/lib/database/require-org"

// The sidebar only *hides* the Admin nav group for non-superadmins — that's
// a UI convenience, not access control. Nothing previously stopped a
// signed-in non-superadmin from reaching /admin/* directly by URL, since
// the admin pages are client components that just render whatever their
// (RLS-scoped) data hooks return rather than checking the caller's role.
// This layout wraps every route under admin/ with the same requireSuperadmin()
// check the API routes already use, so the page itself never renders for
// anyone who isn't actually a superadmin.
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const auth = await requireSuperadmin()
  if (auth.error) {
    redirect({ href: "/", locale })
  }

  return <>{children}</>
}
