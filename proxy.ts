import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { routing, type Locale } from "@/i18n/routing"
import { updateSession } from "@/lib/supabase/proxy"

const handleI18nRouting = createMiddleware(routing)

// Prefixes (locale-stripped, leading slash) that require a signed-in user.
const PROTECTED_PREFIXES = [
  "/sales",
  "/purchases",
  "/catalog",
  "/parties",
  "/inventory",
  "/settings",
  "/admin",
]

// Prefixes that a signed-in user shouldn't see (bounce them to the app instead).
const AUTH_ONLY_PREFIXES = ["/login"]

function localeAndPath(pathname: string): { locale: Locale; path: string } {
  const [, maybeLocale, ...rest] = pathname.split("/")
  if (routing.locales.includes(maybeLocale as Locale)) {
    return { locale: maybeLocale as Locale, path: "/" + rest.join("/") }
  }
  return { locale: routing.defaultLocale, path: pathname }
}

export async function proxy(request: NextRequest) {
  const response = handleI18nRouting(request)
  const user = await updateSession(request, response)

  const { locale, path } = localeAndPath(request.nextUrl.pathname)
  const normalizedPath = path === "" ? "/" : path

  const isProtected =
    normalizedPath === "/" || PROTECTED_PREFIXES.some((p) => normalizedPath.startsWith(p))
  const isAuthOnly = AUTH_ONLY_PREFIXES.some((p) => normalizedPath.startsWith(p))

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}/login`
    return NextResponse.redirect(url)
  }

  if (user && isAuthOnly) {
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}`
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|monitoring|api|auth).*)"],
}
