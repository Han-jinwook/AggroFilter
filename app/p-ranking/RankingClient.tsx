"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AppHeader } from "@/components/c-app-header"
import { YOUTUBE_CATEGORIES } from "@/lib/constants"

interface TChannel {
  id: string
  rank: number
  name: string
  avatar: string
  score: number
  clickbaitScore?: number
  color: string
  highlight?: boolean
  analysisCount?: number
}

interface TRankingApiResponse {
  channels: Array<{
    id: string
    rank: number
    name: string
    avatar: string
    score: number
    categoryId: number
    analysisCount?: number
  }>
  totalCount: number
  nextOffset: number | null
  focusRank: null | {
    id: string
    rank: number
    name: string
    avatar: string
    score: number
    categoryId: number
    totalCount: number
    topPercentile: number | null
  }
  locale?: {
    language: string
    displayName: string
    icon: string
  }
}

interface ActiveLanguage {
  language: string
  channelCount: number
  displayName: string
  icon: string
}

export default function RankingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromTab = searchParams.get("tab")
  
  const currentCategoryId = searchParams.get("category") || ""
  const focusChannelId = searchParams.get("channel") || ""
  const urlLang = searchParams.get("lang") || ""
  const currentCategoryName = currentCategoryId ? (YOUTUBE_CATEGORIES[Number.parseInt(currentCategoryId)] || "전체") : "전체"
  
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false)
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false)
  const [availableCategories, setAvailableCategories] = useState<{id: number, count: number}[]>([])
  
  // 언어 관련 상태 (URL 파라미터 우선)
  const [currentLanguage, setCurrentLanguage] = useState<string>(urlLang || 'korean')
  const [availableLanguages, setAvailableLanguages] = useState<ActiveLanguage[]>([])
  const [localeInfo, setLocaleInfo] = useState<{language: string, displayName: string, icon: string} | null>(null)
  
  const [channels, setChannels] = useState<TChannel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [focusRank, setFocusRank] = useState<TRankingApiResponse['focusRank']>(null)
  const [showSticky, setShowSticky] = useState(false)
  const [sortBy] = useState<'reliability'>('reliability')

  const focusRef = useRef<HTMLDivElement | null>(null)

  // URL의 lang 파라미터와 상태 동기화
  useEffect(() => {
    if (urlLang && urlLang !== currentLanguage) {
      setCurrentLanguage(urlLang)
    }
  }, [urlLang])

  // 브라우저 언어 감지 (초기 로드 시에만)
  useEffect(() => {
    if (urlLang) return // URL에 lang이 있으면 브라우저 감지 스킵
    
    const navLang = navigator.language // 'ko-KR', 'en-US'
    const langMap: Record<string, string> = {
      ko: 'korean',
      en: 'english',
      ja: 'japanese',
      zh: 'chinese',
      es: 'spanish',
      fr: 'french',
      de: 'german',
      ru: 'russian',
    }
    const code = navLang.split('-')[0].toLowerCase()
    const detected = langMap[code] || 'korean'
    setCurrentLanguage(detected)
    console.log('[Language Detection] Browser language:', detected)
  }, [])

  // Active Languages 로드
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const res = await fetch('/api/ranking/locales')
        if (res.ok) {
          const data = await res.json()
          setAvailableLanguages(data.languages || [])
        }
      } catch (error) {
        console.error('Failed to fetch languages:', error)
      }
    }
    fetchLanguages()
  }, [])

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`/api/topics?lang=${currentLanguage}`)
        if (res.ok) {
          const data = await res.json()
          const dbCategories = data.categories || []
          
          // 전체 카테고리 목록 생성 (0개 포함)
          const allCategories = Object.entries(YOUTUBE_CATEGORIES).map(([idStr, name]) => {
            const id = Number.parseInt(idStr)
            const dbCat = dbCategories.find((c: any) => c.id === id)
            return {
              id,
              name,
              count: dbCat ? dbCat.count : 0
            }
          })

          // 정렬 로직: 채널 수 내림차순 -> 이름 오름차순(가나다순)
          const sortedCategories = allCategories.sort((a, b) => {
            if (b.count !== a.count) {
              return b.count - a.count
            }
            return a.name.localeCompare(b.name, 'ko')
          })

          setAvailableCategories(sortedCategories)

        }
      } catch (error) {
        console.error("Failed to fetch categories:", error)
      }
    }
    fetchCategories()
  }, [currentLanguage])

  useEffect(() => {
    const fetchChannels = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const channelQs = focusChannelId ? `&channelId=${encodeURIComponent(focusChannelId)}` : ''
        const langQs = `&lang=${currentLanguage}`
        const res = await fetch(`/api/ranking?category=${currentCategoryId}&limit=1000&offset=0${channelQs}${langQs}`)
        if (!res.ok) {
          const bodyText = await res.text().catch(() => '')
          console.error('[RankingClient] /api/ranking failed', {
            status: res.status,
            statusText: res.statusText,
            body: bodyText,
          })
          setLoadError(`랭킹 데이터를 불러오지 못했습니다. (HTTP ${res.status})`)
          setChannels([])
          setTotalCount(0)
          setFocusRank(null)
          setLocaleInfo(null)
          return
        }
        const data = (await res.json()) as TRankingApiResponse
        
        // 카테고리 필터가 있는데 결과가 0개이면 → 전체로 fallback
        if ((data.channels || []).length === 0 && currentCategoryId) {
          const channelParam = focusChannelId ? `&channel=${focusChannelId}` : ''
          router.replace(`/p-ranking?category=&lang=${currentLanguage}${channelParam}`)
          return
        }
        
        let formatted = (data.channels || []).map((c) => ({
          id: c.id,
          rank: c.rank,
          name: c.name,
          avatar: c.avatar,
          score: c.score,
          clickbaitScore: c.clickbaitScore || 0,
          color: c.score >= 70 ? "text-green-500" : c.score >= 50 ? "text-orange-500" : "text-red-500",
          highlight: false,
          analysisCount: c.analysisCount || 0,
        }))
        
        // 신뢰도 기준 정렬 (서버에서 이미 정렬되어 있음)
        formatted = formatted.sort((a, b) => b.score - a.score)
        
        // 정렬 후 순위 재계산
        formatted = formatted.map((channel, index) => ({
          ...channel,
          rank: index + 1
        }))
        
        setChannels(formatted)
        setTotalCount(data.totalCount || 0)
        setFocusRank(data.focusRank)
        setLocaleInfo(data.locale || null)
      } catch (error) {
        console.error("Failed to fetch ranking:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchChannels()
  }, [currentCategoryId, focusChannelId, currentLanguage, sortBy])


  // Sticky My-Rank bar visibility
  useEffect(() => {
    const handleScroll = () => {
      if (!focusRank) {
        setShowSticky(false)
        return
      }
      if (!focusRef.current) {
        setShowSticky(true)
        return
      }
      const rect = focusRef.current.getBoundingClientRect()
      const isOffScreen = rect.top > window.innerHeight || rect.bottom < 0
      setShowSticky(isOffScreen)
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [focusRank, channels])

  const scrollToFocus = () => {
    if (!focusRank) return
    if (focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const toggleTooltip = (tooltipId: string) => {
    setActiveTooltip(activeTooltip === tooltipId ? null : tooltipId)
  }

  const handleTopicDropdownToggle = () => {
    setIsTopicDropdownOpen(!isTopicDropdownOpen)
    setIsLanguageDropdownOpen(false)
  }

  const handleLanguageDropdownToggle = () => {
    setIsLanguageDropdownOpen(!isLanguageDropdownOpen)
    setIsTopicDropdownOpen(false)
  }

  const handleCategoryClick = (categoryId: string) => {
    const channelParam = focusChannelId ? `&channel=${focusChannelId}` : ''
    const langParam = currentLanguage ? `&lang=${currentLanguage}` : ''
    router.push(`/p-ranking?category=${categoryId}${langParam}${channelParam}`)
    setIsTopicDropdownOpen(false)
  }

  const handleLanguageClick = (language: string) => {
    setIsLanguageDropdownOpen(false)
    // 언어 변경 시 카테고리를 전체로 리셋하고 lang 파라미터 추가
    const channelParam = focusChannelId ? `&channel=${focusChannelId}` : ''
    const categoryParam = currentCategoryId ? `category=${currentCategoryId}` : 'category='
    router.push(`/p-ranking?${categoryParam}&lang=${language}${channelParam}`)
  }

  const renderChannelRow = (channel: TChannel) => {
    const isFocus = focusRank != null && channel.id === focusRank.id
    return (
      <Link key={channel.rank} href={`/channel/${channel.id}`} className="block">
        <div
          ref={isFocus ? focusRef : undefined}
          className={`relative grid grid-cols-[28px_1fr_auto] md:grid-cols-[60px_1fr_70px_80px] items-center gap-1 md:gap-2 border-b px-2 md:px-4 py-2.5 last:border-0 cursor-pointer transition-all duration-300 ${
            isFocus
              ? "bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)] my-1 rounded-xl scale-[1.02] z-10 overflow-visible"
              : "border-gray-100 hover:bg-gray-50"
          }`}
          style={isFocus ? { animation: 'myRankPulse 2.5s ease-in-out infinite' } : undefined}
        >
          {isFocus && (
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 bg-indigo-600 text-white text-[11px] font-bold px-1 py-0.5 rounded-sm shadow-md leading-none z-[100]">
              ▶
            </div>
          )}
          <div
            className={`text-center text-sm md:text-base font-bold ${isFocus ? "text-indigo-700" : "text-gray-800"}`}
          >
            {channel.rank}
          </div>
          <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
            <div className={`relative flex-shrink-0 ${isFocus ? "ring-2 ring-indigo-400 ring-offset-1 rounded-full" : ""}`}>
              <Image
                src={channel.avatar || "/placeholder.svg"}
                alt={channel.name}
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
              />
            </div>
            <span className={`text-sm font-medium truncate ${isFocus ? "text-indigo-900 font-bold" : "text-gray-800"}`}>
              {channel.name}
            </span>
          </div>
          {/* Mobile: 분석영상+신뢰도/어그로 합침 */}
          <div className="flex md:hidden items-center gap-1.5 flex-shrink-0 pl-2">
            <span className={`text-xs font-medium ${isFocus ? "text-indigo-400" : "text-gray-400"}`}>
              {channel.analysisCount || 0}개
            </span>
            <span className={`text-sm font-bold ${isFocus ? "text-indigo-700" : "text-gray-800"}`}>
              {channel.score}
            </span>
            <span className={`text-base ${channel.color}`}>●</span>
          </div>
          {/* PC: 분석영상 별도 컬럼 */}
          <div className="hidden md:block text-center">
            <span className={`text-sm font-medium ${isFocus ? "text-indigo-500" : "text-gray-500"}`}>
              {channel.analysisCount || 0}개
            </span>
          </div>
          {/* PC: 신뢰도/어그로 점수 별도 컬럼 */}
          <div className="hidden md:flex items-center justify-end gap-2 pr-2">
            <span className={`text-base font-bold ${isFocus ? "text-indigo-700" : "text-gray-800"}`}>
              {channel.score}
            </span>
            <span className={`text-xl ${channel.color}`}>●</span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="pt-4 pb-6">
        <div className="mx-auto max-w-[var(--app-max-width)] px-4">
            <div className="relative rounded-3xl bg-blue-100 px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <button
                onClick={() => {
                  if (fromTab === "realtime_video") {
                    router.push("/real-time-best?tab=videos")
                  } else if (fromTab === "realtime_channel") {
                    router.push("/real-time-best?tab=channels")
                  } else if (fromTab === "analysis") {
                    router.push("/my-page?tab=analysis")
                  } else if (fromTab === "subscribed") {
                    router.push("/my-page?tab=subscribed")
                  } else {
                    router.back()
                  }
                }}
                className="hidden md:flex items-center justify-center text-black transition-colors hover:text-gray-700"
                aria-label="뒤로 가기"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="relative flex w-auto md:w-[140px] flex-shrink-0 items-center gap-1 rounded-2xl bg-blue-200 px-2 md:px-4 py-1">
                <h2 className="whitespace-nowrap text-sm md:text-lg font-bold text-pink-500">채널 랭킹</h2>
                <div className="relative -mt-2 hidden md:block">
                  <button
                    onMouseEnter={() => setActiveTooltip("ranking")}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => toggleTooltip("ranking")}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-[11px] font-bold text-white hover:bg-slate-600"
                  >
                    ?
                  </button>
                  {activeTooltip === "ranking" && (
                    <div className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-lg border-2 border-gray-300 bg-white p-3 shadow-lg">
                      <p className="text-xs leading-relaxed text-gray-700">
                        현재 카테고리에 대한 채널들의 신뢰도 점수를 기준으로 순위를 매깁니다.
                      </p>
                      <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-gray-300 bg-white"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="relative flex min-w-0 flex-1 items-center gap-1 md:gap-2 rounded-full border-2 border-pink-400 bg-white px-2 md:px-4 py-1.5">
                <span className="text-sm md:text-base font-bold text-pink-500">#</span>
                <span className="flex-1 text-sm md:text-base font-bold text-gray-800 truncate">
                  {currentCategoryName}
                </span>
              </div>
              <div className="relative flex items-center gap-2 flex-shrink-0">
                {/* 언어 선택 드롭다운 */}
                <button
                  onClick={handleLanguageDropdownToggle}
                  className="flex h-8 px-3 items-center justify-center gap-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-medium"
                >
                  <span>{localeInfo?.displayName || '언어'}</span>
                  <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isLanguageDropdownOpen && (
                  <div className="absolute right-10 top-full z-30 mt-2 w-48 rounded-2xl bg-indigo-600 p-3 shadow-xl">
                    <h3 className="text-xs font-bold text-white mb-2 pb-2 border-b border-indigo-500">
                      언어 선택
                    </h3>
                    <div className="space-y-1">
                      {availableLanguages.map((lang) => (
                        <button
                          key={lang.language}
                          onClick={() => handleLanguageClick(lang.language)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            currentLanguage === lang.language
                              ? 'bg-indigo-700 text-white font-bold'
                              : 'text-white hover:bg-indigo-700'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{lang.icon}</span>
                            <span>{lang.displayName}</span>
                          </span>
                          <span className="text-xs text-indigo-300">({lang.channelCount})</span>
                        </button>
                      ))}
                    </div>
                    <div className="absolute -top-2 right-3 h-4 w-4 rotate-45 bg-indigo-600"></div>
                  </div>
                )}
                
                {/* 카테고리 선택 드롭다운 */}
                <button
                  onClick={handleTopicDropdownToggle}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-600 text-white hover:bg-slate-700"
                >
                  <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isTopicDropdownOpen && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-64 max-h-80 overflow-y-auto rounded-2xl bg-slate-600 p-4 shadow-xl custom-scrollbar">
                    <button 
                      onClick={() => handleCategoryClick('')}
                      className="w-full mb-3 flex items-center justify-between border-b border-slate-500 pb-2 text-left transition-colors hover:bg-slate-700 rounded-t-lg -mx-4 -mt-4 px-4 pt-4"
                    >
                      <h3 className="text-sm font-bold text-white">
                        유튜브 공식 카테고리 ({availableCategories.length})
                      </h3>
                      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <div className="space-y-1">
                      {availableCategories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => handleCategoryClick(cat.id.toString())}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-white transition-colors hover:bg-slate-700"
                        >
                          <span className="truncate">#{cat.name}</span>
                          <span className="ml-2 flex-shrink-0 text-xs text-slate-300">({cat.count})</span>
                        </button>
                      ))}
                    </div>
                    <div className="absolute -top-2 right-3 h-4 w-4 rotate-45 bg-slate-600"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Top 3 Hall of Fame */}
            {!isLoading && channels.length > 0 && (
              <div className="mb-6 mt-4 grid grid-cols-3 gap-2 items-end px-2 max-w-sm mx-auto">
                {/* 2nd Place */}
                <div 
                  className="flex flex-col items-center"
                  ref={focusRank && channels.find(c => c.rank === 2)?.id === focusRank.id ? focusRef : undefined}
                >
                  {channels.find(c => c.rank === 2) && (
                    <Link href={`/channel/${channels.find(c => c.rank === 2)!.id}`} className="flex flex-col items-center w-full group">
                      <div className="relative w-16 h-16 mb-2">
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-slate-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm ring-2 ring-white whitespace-nowrap">2위</div>
                        <Image
                          src={channels.find(c => c.rank === 2)!.avatar || "/placeholder.svg"}
                          alt="2nd"
                          fill
                          className="rounded-full object-cover border-4 border-slate-300 shadow-md group-hover:scale-105 transition-transform bg-white"
                        />
                      </div>
                      <div className="text-center w-full">
                        <div className="text-xs font-bold text-slate-800 truncate px-1">{channels.find(c => c.rank === 2)!.name}</div>
                        <div className="text-[10px] font-bold text-slate-500">{channels.find(c => c.rank === 2)!.score}점</div>
                      </div>
                    </Link>
                  )}
                </div>

                {/* 1st Place */}
                <div 
                  className="flex flex-col items-center -mt-4 z-10 w-full"
                  ref={focusRank && channels.find(c => c.rank === 1)?.id === focusRank.id ? focusRef : undefined}
                >
                  {channels.find(c => c.rank === 1) && (
                    <Link href={`/channel/${channels.find(c => c.rank === 1)!.id}`} className="flex flex-col items-center w-full group">
                      <div className="relative w-24 h-24 mb-2">
                        <div className="absolute -top-3 md:-top-7 left-1/2 -translate-x-1/2 text-lg md:text-3xl drop-shadow-md filter">👑</div>
                        <div className="absolute -top-1 md:-top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-white text-[10px] md:text-xs font-bold px-2 md:px-3 py-0.5 rounded-full z-10 shadow-sm ring-2 ring-white whitespace-nowrap">1위</div>
                        <Image
                          src={channels.find(c => c.rank === 1)!.avatar || "/placeholder.svg"}
                          alt="1st"
                          fill
                          className="rounded-full object-cover border-4 border-yellow-400 shadow-xl group-hover:scale-105 transition-transform bg-white"
                        />
                      </div>
                      <div className="text-center w-full">
                        <div className="text-sm font-black text-slate-900 truncate px-1">{channels.find(c => c.rank === 1)!.name}</div>
                        <div className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full inline-block mt-1">{channels.find(c => c.rank === 1)!.score}점</div>
                      </div>
                    </Link>
                  )}
                </div>

                {/* 3rd Place */}
                <div 
                  className="flex flex-col items-center"
                  ref={focusRank && channels.find(c => c.rank === 3)?.id === focusRank.id ? focusRef : undefined}
                >
                  {channels.find(c => c.rank === 3) && (
                    <Link href={`/channel/${channels.find(c => c.rank === 3)!.id}`} className="flex flex-col items-center w-full group">
                      <div className="relative w-16 h-16 mb-2">
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-orange-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm ring-2 ring-white whitespace-nowrap">3위</div>
                        <Image
                          src={channels.find(c => c.rank === 3)!.avatar || "/placeholder.svg"}
                          alt="3rd"
                          fill
                          className="rounded-full object-cover border-4 border-orange-300 shadow-md group-hover:scale-105 transition-transform bg-white"
                        />
                      </div>
                      <div className="text-center w-full">
                        <div className="text-xs font-bold text-slate-800 truncate px-1">{channels.find(c => c.rank === 3)!.name}</div>
                        <div className="text-[10px] font-bold text-slate-500">{channels.find(c => c.rank === 3)!.score}점</div>
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-t-3xl border-x-4 border-t-4 border-blue-400 bg-white">
              <div className="grid grid-cols-[28px_1fr_auto] md:grid-cols-[60px_1fr_70px_80px] gap-1 md:gap-2 bg-gradient-to-r from-blue-200 to-indigo-200 px-2 md:px-4 py-2">
                <div className="text-center text-xs md:text-sm font-bold text-gray-800">순위</div>
                <div className="text-sm font-bold text-gray-800 pl-1">채널명 {!isLoading && totalCount > 0 && <span className="text-xs font-medium text-gray-500">(총 {totalCount.toLocaleString()}개)</span>}</div>
                <div className="text-center text-xs font-bold text-gray-800 whitespace-nowrap pr-1 md:hidden">분석 영상</div>
                <div className="hidden md:block text-center text-xs font-bold text-gray-800 whitespace-nowrap">분석 영상</div>
                <div className="hidden md:block text-center text-xs font-bold text-gray-800 whitespace-nowrap">신뢰도</div>
              </div>
            </div>


            <div className="rounded-b-3xl border-x-4 border-b-4 border-blue-400 bg-white min-h-[300px] overflow-visible">
              {isLoading ? (
                <div className="flex h-[300px] w-full flex-col items-center justify-center gap-3 text-slate-400">
                   <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500"></div>
                   <p className="text-sm font-medium">채널 데이터를 분석하고 있습니다...</p>
                </div>
              ) : loadError ? (
                <div className="flex h-[300px] w-full flex-col items-center justify-center gap-3 text-slate-400">
                  <p className="text-sm font-medium">{loadError}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    새로고침
                  </button>
                </div>
              ) : channels.length === 0 ? (
                <div className="flex h-[300px] w-full flex-col items-center justify-center gap-3 text-slate-400">
                    <p className="text-sm font-medium">검색 결과가 없습니다.</p>
                </div>
              ) : (
                <div>
                  {channels.map((channel) => renderChannelRow(channel))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showSticky && focusRank && (
        <div
          onClick={scrollToFocus}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl z-50"
        >
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 px-3 py-1 rounded-full text-sm font-bold">▶</div>
              <div className="flex flex-col">
                <div className="text-sm font-bold">
                  {focusRank.rank.toLocaleString()}위
                  {focusRank.topPercentile !== null ? (
                    <span className="ml-2 text-slate-300 text-xs font-medium">(상위 {focusRank.topPercentile}%)</span>
                  ) : null}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {currentCategoryName}
                </div>
              </div>
            </div>
            <div className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Jump</div>
          </div>
        </div>
      )}
    </div>
  )
}
