import {  Geist_Mono, Inter, Roboto } from "next/font/google"
import { getLocale } from "next-intl/server"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemePresetScript } from "@/components/theme-preset-script"
import { QueryProvider } from "@/components/providers/query-provider"
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const robotoHeading = Roboto({subsets:['latin'],variable:'--font-heading'});

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable, robotoHeading.variable)}
    >
      <head>
        <ThemePresetScript />
      </head>
      <body>
        <QueryProvider>
          <ThemeProvider>
             <TooltipProvider>{children}</TooltipProvider></ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
