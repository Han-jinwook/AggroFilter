import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/react"
import { ThemeProvider } from "@/components/c-theme-provider"
import "./globals.css"
import { BottomBanner } from "@/components/c-bottom-banner"
import { SideWingAds } from "@/components/c-side-wing-ads"
import { GlobalLoginModal } from "@/components/c-global-login-modal"
import { ToastContainer } from "@/components/c-toast"

interface TRootLayoutProps {
  children: React.ReactNode
}

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "https://aggrofilter.com"
  ),
  title: {
    default: "어그로필터 | AI 유튜브 신뢰도 분석",
    template: "%s | 어그로필터",
  },
  description: "유튜브 영상의 신뢰도를 AI로 분석합니다. 어그로성, 정확성, 신뢰도 점수를 한눈에 확인하세요.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "어그로필터 | AI 유튜브 신뢰도 분석",
    description: "유튜브 영상의 신뢰도를 AI로 분석합니다. 어그로성, 정확성, 신뢰도 점수를 한눈에 확인하세요.",
    url: "/",
    siteName: "어그로필터",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "어그로필터",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "어그로필터 | AI 유튜브 신뢰도 분석",
    description: "유튜브 영상의 신뢰도를 AI로 분석합니다. 어그로성, 정확성, 신뢰도 점수를 한눈에 확인하세요.",
    images: ["/og"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
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
          <ToastContainer />
          <SideWingAds />
          <BottomBanner />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
