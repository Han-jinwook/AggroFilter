"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
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
  myRank: null | {
    id: string
    rank: number
    name: string
    avatar: string
    score: number
    categoryId: number
    totalCount: number
    topPercentile: number | null
  }
}

export default function RankingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromTab = searchParams.get("tab")
  
  const currentCategoryId = searchParams.get("category") || ""
  const currentCategoryName = currentCategoryId ? (YOUTUBE_CATEGORIES[Number.parseInt(currentCategoryId)] || "전체") : "전체"
  
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false)
  const [availableCategories, setAvailableCategories] = useState<{id: number, count: number}[]>([])
  
  const [channels, setChannels] = useState<TChannel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [myRank, setMyRank] = useState<TRankingApiResponse['myRank']>(null)
  const [showSticky, setShowSticky] = useState(false)

  const myRankRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const nextOffsetRef = useRef<number | null>(0)
  const channelsLengthRef = useRef<number>(0)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/topics')
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
  }, [])

  useEffect(() => {
    const fetchChannels = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const focusChannelIdNow = typeof window !== 'undefined' ? localStorage.getItem('focusChannelId') : null
        const focusQs = focusChannelIdNow ? `&channelId=${encodeURIComponent(focusChannelIdNow)}` : ''
        const res = await fetch(`/api/ranking?category=${currentCategoryId}&limit=20&offset=0${focusQs}`)
        if (!res.ok) {
          const bodyText = await res.text().catch(() => '')
          console.error('[RankingClient] /api/ranking failed', {
            status: res.status,
            statusText: res.statusText,
            body: bodyText,
          })
          setLoadError(`랭킹 데이터를 불러오지 못했습니다. (HTTP ${res.status})`)
          setChannels([])
          setNextOffset(null)
          setTotalCount(0)
          setMyRank(null)
          return
        }
        const data = (await res.json()) as TRankingApiResponse
        const formatted = (data.channels || []).map((c) => ({
          id: c.id,
          rank: c.rank,
          name: c.name,
          avatar: c.avatar,
          score: c.score,
          color: c.score >= 70 ? "text-green-500" : c.score >= 50 ? "text-orange-500" : "text-red-500",
          highlight: false,
          analysisCount: c.analysisCount || 0,
        }))
        setChannels(formatted)
        setNextOffset(data.nextOffset)
        setTotalCount(data.totalCount || 0)
        setMyRank(data.myRank)
      } catch (error) {
        console.error("Failed to fetch ranking:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchChannels()
  }, [currentCategoryId])

  useEffect(() => {
    nextOffsetRef.current = nextOffset
  }, [nextOffset])

  useEffect(() => {
    channelsLengthRef.current = channels.length
  }, [channels.length])

  const fetchMore = useCallback(async () => {
    if (isLoadingMore) return
    const currentOffset = nextOffsetRef.current
    if (currentOffset === null) return
    setIsLoadingMore(true)
    try {
      const focusChannelIdNow = typeof window !== 'undefined' ? localStorage.getItem('focusChannelId') : null
      const focusQs = focusChannelIdNow ? `&channelId=${encodeURIComponent(focusChannelIdNow)}` : ''
      const res = await fetch(`/api/ranking?category=${currentCategoryId}&limit=20&offset=${currentOffset}${focusQs}`)
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '')
        console.error('[RankingClient] /api/ranking (fetchMore) failed', {
          status: res.status,
          statusText: res.statusText,
          body: bodyText,
        })
        return
      }
      const data = (await res.json()) as TRankingApiResponse

      const formatted = (data.channels || []).map((c) => ({
        id: c.id,
        rank: c.rank,
        name: c.name,
        avatar: c.avatar,
        score: c.score,
        color: c.score >= 70 ? "text-green-500" : c.score >= 50 ? "text-orange-500" : "text-red-500",
        highlight: false,
        analysisCount: c.analysisCount || 0,
      }))

      setChannels((prev) => [...prev, ...formatted])
      setNextOffset(data.nextOffset)
      setTotalCount(data.totalCount || 0)
      setMyRank(data.myRank)
    } catch (error) {
      console.error("Failed to fetch more ranking:", error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [currentCategoryId, isLoadingMore])

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return
    const target = loadMoreRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchMore()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [fetchMore])

  // Sticky My-Rank bar visibility
  useEffect(() => {
    const handleScroll = () => {
      if (!myRank) {
        setShowSticky(false)
        return
      }
      if (!myRankRef.current) {
        // Not loaded into DOM yet -> definitely off-screen
        setShowSticky(true)
        return
      }
      const rect = myRankRef.current.getBoundingClientRect()
      const isOffScreen = rect.top > window.innerHeight || rect.bottom < 0
      setShowSticky(isOffScreen)
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [myRank, channels])

  const scrollToMyRank = async () => {
    if (!myRank) return

    // If my rank row exists in current DOM, scroll immediately.
    if (myRankRef.current) {
      myRankRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    // Otherwise load pages until we include the rank, or until exhausted.
    // We estimate needed offset by (rank - 1), since we use deterministic ordering.
    const desiredIndex = Math.max(0, myRank.rank - 1)
    while (nextOffsetRef.current !== null && channelsLengthRef.current <= desiredIndex) {
      await fetchMore()
      // Yield back to allow DOM updates
      await new Promise((r) => setTimeout(r, 0))
    }

    if (myRankRef.current) {
      myRankRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const toggleTooltip = (tooltipId: string) => {
    setActiveTooltip(activeTooltip === tooltipId ? null : tooltipId)
  }

  const handleTopicDropdownToggle = () => {
    setIsTopicDropdownOpen(!isTopicDropdownOpen)
  }

  const handleCategoryClick = (categoryId: string) => {
    router.push(`/p-ranking?category=${categoryId}`)
    setIsTopicDropdownOpen(false)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="py-6 pt-6">
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
                className="flex items-center justify-center text-black transition-colors hover:text-gray-700"
                aria-label="뒤로 가기"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="relative flex w-[140px] flex-shrink-0 items-center gap-1 rounded-2xl bg-blue-200 px-4 py-1">
                <h2 className="whitespace-nowrap text-lg font-bold text-pink-500">채널 랭킹</h2>
                <div className="relative -mt-2">
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
              <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-full border-2 border-pink-400 bg-white px-4 py-1.5">
                <span className="text-base font-bold text-pink-500">#</span>
                <span className="flex-1 text-base font-bold text-gray-800 truncate">
                  {currentCategoryName}
                </span>
              </div>
              <div className="relative flex-shrink-0">
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
                    <div className="mb-3 flex items-center justify-between border-b border-slate-500 pb-2">
                      <h3 className="text-sm font-bold text-white">
                        유튜브 공식 카테고리 ({availableCategories.length})
                      </h3>
                      <button onClick={() => setIsTopicDropdownOpen(false)}>
                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                    </div>
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
                  ref={myRank && channels.find(c => c.rank === 2)?.id === myRank.id ? myRankRef : undefined}
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
                  ref={myRank && channels.find(c => c.rank === 1)?.id === myRank.id ? myRankRef : undefined}
                >
                  {channels.find(c => c.rank === 1) && (
                    <Link href={`/channel/${channels.find(c => c.rank === 1)!.id}`} className="flex flex-col items-center w-full group">
                      <div className="relative w-24 h-24 mb-2">
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-3xl animate-bounce drop-shadow-md filter">👑</div>
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-500 text-white text-xs font-bold px-3 py-0.5 rounded-full z-10 shadow-sm ring-2 ring-white whitespace-nowrap">1위</div>
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
                  ref={myRank && channels.find(c => c.rank === 3)?.id === myRank.id ? myRankRef : undefined}
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
              <div className="grid grid-cols-[60px_1fr_70px_80px] gap-2 bg-gradient-to-r from-blue-200 to-indigo-200 px-4 py-2">
                <div className="text-center text-sm font-bold text-gray-800">순위</div>
                <div className="text-center text-sm font-bold text-gray-800">채널명</div>
                <div className="text-center text-xs font-bold text-gray-800 whitespace-nowrap">분석 영상</div>
                <div className="text-center text-xs font-bold text-gray-800 whitespace-nowrap">신뢰도 점수</div>
              </div>
            </div>


            <div className="overflow-hidden rounded-b-3xl border-x-4 border-b-4 border-blue-400 bg-white min-h-[300px]">
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
                  {channels.map((channel) => (
                  <Link key={channel.rank} href={`/channel/${channel.id}`} className="block">
                    <div
                      ref={myRank && channel.id === myRank.id ? myRankRef : undefined}
                      className={`grid grid-cols-[60px_1fr_70px_80px] items-center gap-2 border-b border-gray-100 px-4 py-2.5 last:border-0 cursor-pointer transition-colors ${
                        channel.highlight ? "bg-slate-600" : "hover:bg-gray-50"
                      }`}
                    >
                      <div
                        className={`text-center text-base font-bold ${channel.highlight ? "text-white" : "text-gray-800"}`}
                      >
                        {channel.rank}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Image
                          src={channel.avatar || "/placeholder.svg"}
                          alt={channel.name}
                          width={36}
                          height={36}
                          className="h-9 w-9 rounded-full object-cover"
                        />
                        <span className={`text-sm font-medium ${channel.highlight ? "text-white" : "text-gray-800"}`}>
                          {channel.name}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className={`text-sm font-medium ${channel.highlight ? "text-white/70" : "text-gray-500"}`}>
                          {channel.analysisCount || 0}개
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2 pr-2">
                        <span className={`text-base font-bold ${channel.highlight ? "text-white" : "text-gray-800"}`}>
                          {channel.score}
                        </span>
                        <span className={`text-xl ${channel.color}`}>●</span>
                      </div>
                    </div>
                  </Link>
                ))}
                  <div ref={loadMoreRef} className="py-4">
                    {isLoadingMore ? (
                      <div className="flex items-center justify-center gap-2 text-slate-500">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-purple-500"></div>
                        <span className="text-sm">로딩 중...</span>
                      </div>
                    ) : nextOffset !== null ? (
                      <div className="text-center text-xs text-slate-400">스크롤하여 더보기</div>
                    ) : (
                      <div className="text-center text-xs text-slate-400">
                        총 {totalCount.toLocaleString()}개
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showSticky && myRank && (
        <div
          onClick={scrollToMyRank}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl z-50"
        >
          <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 px-3 py-1 rounded-full text-xs font-bold">MY</div>
              <div className="text-sm font-bold">
                {myRank.rank.toLocaleString()}위
                {myRank.topPercentile !== null ? (
                  <span className="ml-2 text-slate-300 text-xs font-medium">(상위 {myRank.topPercentile}%)</span>
                ) : null}
              </div>
            </div>
            <div className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Jump</div>
          </div>
        </div>
      )}
    </div>
  )
}
