import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/react"
import { ThemeProvider } from "@/components/c-theme-provider"
import "./globals.css"
import { BottomBanner } from "@/components/c-bottom-banner"
import { SideWingAds } from "@/components/c-side-wing-ads"
import { GlobalLoginModal } from "@/components/c-global-login-modal"

interface TRootLayoutProps {
  children: React.ReactNode
}

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AggroFilter",
  description: "AI-powered YouTube content analysis",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
    generator: 'v0.app'
}

export default function RootLayout({ children }: TRootLayoutProps) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <GlobalLoginModal />
          <SideWingAds />
          <BottomBanner />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
