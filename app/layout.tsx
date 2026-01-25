import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { BottomBanner } from "@/components/c-bottom-banner"
import { SideWingAds } from "@/components/c-side-wing-ads"

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
    <html lang="ko">
      <body className={inter.className}>
        {children}
        <SideWingAds />
        <BottomBanner />
      </body>
    </html>
  )
}
