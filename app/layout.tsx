import React, { Suspense } from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/react"
import { ThemeProvider } from "@/components/c-theme-provider"
import "./globals.css"
import { BottomBanner } from "@/components/c-bottom-banner"
import { SideWingAds } from "@/components/c-side-wing-ads"
import { GlobalLoginModal } from "@/components/c-global-login-modal"
import { ToastContainer } from "@/components/c-toast"
import { HubNotifier, HubProvider } from "@/src/services/merlin-hub-sdk/react"
import { Footer } from "@/components/c-footer"

import { ReferralTracker } from "@/components/ReferralTracker"

interface TRootLayoutProps {
  children: React.ReactNode
}

const inter = Inter({ subsets: ["latin"] })

function getSafeMetadataBase(): URL {
  const candidates = [
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.URL,
    'https://aggrofilter.com',
  ]

  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue
    const value = raw.trim()
    if (!value) continue

    try {
      return new URL(value)
    } catch {
      try {
        return new URL(`https://${value}`)
      } catch {
      }
    }
  }

  return new URL('https://aggrofilter.com')
}

export const metadata: Metadata = {
  metadataBase: getSafeMetadataBase(),
  title: {
    default: "어그로필터 | AI 유튜브 신뢰도 분석",
    template: "%s | 어그로필터",
  },
  description: "썸네일 스포일러 / AI 정밀 팩트체크 / 청정 유튜버 랭킹",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "어그로필터 | AI 유튜브 신뢰도 분석",
    description: "썸네일 스포일러 / AI 정밀 팩트체크 / 청정 유튜버 랭킹",
    url: "/",
    siteName: "어그로필터",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "어그로필터",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "어그로필터 | AI 유튜브 신뢰도 분석",
    description: "썸네일 스포일러 / AI 정밀 팩트체크 / 청정 유튜버 랭킹",
    images: ["/og-image.png"],
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
      <head>
        <meta name="theme-color" content="#6366f1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                if (!('serviceWorker' in navigator)) return;

                window.addEventListener('load', async () => {
                  const registrations = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(registrations.map((registration) => registration.unregister()));

                  if ('caches' in window) {
                    const cacheKeys = await caches.keys();
                    await Promise.all(
                      cacheKeys
                        .filter((key) => key.startsWith('aggrofilter-'))
                        .map((key) => caches.delete(key))
                    );
                  }
                });
              })();
            `
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <HubProvider appId="AggroFilter">
            <HubNotifier />
            <Suspense fallback={null}>
              <ReferralTracker />
            </Suspense>
            <div className="flex min-h-screen flex-col">
              <div className="flex-1">
                {children}
              </div>
              <Footer />
            </div>
            <GlobalLoginModal />
            <HubNotifier />
            <SideWingAds />
            <BottomBanner />
            <Analytics />
          </HubProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
