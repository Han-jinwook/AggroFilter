import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { BottomBanner } from "@/components/bottom-banner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AggroFilter",
  description: "AI-powered YouTube content analysis",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {children}
        <BottomBanner />
      </body>
    </html>
  )
}
