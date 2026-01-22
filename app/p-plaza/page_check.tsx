"use client"

import type React from "react"
import { AppHeader } from "@/components/c-app-header"
import { HotIssueCard } from "@/app/p-plaza/c-plaza/hot-issue-card"
import { HotChannelCard } from "@/app/p-plaza/c-plaza/hot-channel-card"
import {
  ChevronDown,
  TrendingUp,
  Clock,
  Activity,
  ArrowUpDown,
  Search,
  X,
} from "lucide-react"
import Image from "next/image"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface TVideoData {
  id?: string
  date: string
  title: string
  channel: string
  views: string
  score: number
  color: "green" | "red"
  topic?: string
  channelIcon?: string
}

export default function PlazaPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"video" | "channel">("video")
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [hotFilter, setHotFilter] = useState<"views" | "trust" | "aggro">("views")
  const [sortDirection, setSortDirection] = useState<"best" | "worst">("best")

  const [channelHotFilter, setChannelHotFilter] = useState<"views" | "trust" | "controversy">("views")
  const [channelSortDirection, setChannelSortDirection] = useState<"best" | "worst">("best")

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPeriod, setSelectedPeriod] = useState<"1?? | "1二쇱씪" | "1媛쒖썡">("1二쇱씪")

  const [allAnalyzedVideos, setAllAnalyzedVideos] = useState<TVideoData[]>([])
  const [displayedVideos, setDisplayedVideos] = useState(10)
  const [isLoadingVideos, setIsLoadingVideos] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isInfiniteScrollEnabled, setIsInfiniteScrollEnabled] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)

  const [videoSortConfig, setVideoSortConfig] = useState<{
    key: "date" | "views" | "score"
    direction: "asc" | "desc"
  }>({ key: "date", direction: "desc" })

  const [hotIssues, setHotIssues] = useState<any[]>([])
  const [isLoadingHotIssues, setIsLoadingHotIssues] = useState(true)

  const [hotChannels, setHotChannels] = useState<any[]>([])
  const [isLoadingHotChannels, setIsLoadingHotChannels] = useState(true)

  const handleVideoSort = (key: "date" | "views" | "score") => {
    setVideoSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }))
  }

  useEffect(() => {
    const fetchVideos = async () => {
      setIsLoadingVideos(true)
      try {
        const res = await fetch(`/api/plaza/videos?period=${selectedPeriod}&sort=${videoSortConfig.key}&direction=${videoSortConfig.direction}`)
        if (res.ok) {
          const data = await res.json()
          setAllAnalyzedVideos(data.videos || [])
        }
      } catch (error) {
        console.error('Failed to fetch videos:', error)
      } finally {
        setIsLoadingVideos(false)
      }
    }
    fetchVideos()
  }, [selectedPeriod, videoSortConfig])

  useEffect(() => {
    const fetchHotIssues = async () => {
      setIsLoadingHotIssues(true)
      try {
        let sort = 'views'
        let direction = 'desc'
        if (hotFilter === 'trust') {
          sort = 'trust'
          direction = sortDirection === 'best' ? 'desc' : 'asc'
        } else if (hotFilter === 'aggro') {
          sort = 'aggro'
          direction = sortDirection === 'best' ? 'desc' : 'asc'
        }
        const res = await fetch(`/api/plaza/hot-issues?sort=${sort}&direction=${direction}`)
        if (res.ok) {
          const data = await res.json()
          setHotIssues(data.hotIssues || [])
        }
      } catch (error) {
        console.error('Failed to fetch hot issues:', error)
      } finally {
        setIsLoadingHotIssues(false)
      }
    }
    fetchHotIssues()
  }, [hotFilter, sortDirection])

  useEffect(() => {
    const fetchHotChannels = async () => {
      setIsLoadingHotChannels(true)
      try {
        const res = await fetch(`/api/plaza/hot-channels?filter=${channelHotFilter}&direction=${channelSortDirection}`)
        if (res.ok) {
          const data = await res.json()
          setHotChannels(data.hotChannels || [])
        }
      } catch (error) {
        console.error('Failed to fetch hot channels:', error)
      } finally {
        setIsLoadingHotChannels(false)
      }
    }
    fetchHotChannels()
  }, [channelHotFilter, channelSortDirection])

  useEffect(() => {
    if (!isInfiniteScrollEnabled) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && displayedVideos < allAnalyzedVideos.length) {
          setIsLoadingMore(true)
          setTimeout(() => {
            setDisplayedVideos((prev) => Math.min(prev + 10, allAnalyzedVideos.length))
            setIsLoadingMore(false)
          }, 500)
        }
      },
      { threshold: 0.1 },
    )
    if (observerTarget.current) observer.observe(observerTarget.current)
    return () => observer.disconnect()
  }, [isInfiniteScrollEnabled, isLoadingMore, displayedVideos, allAnalyzedVideos.length])

  const handleLoadMore = () => {
    setIsInfiniteScrollEnabled(true)
    setDisplayedVideos((prev) => Math.min(prev + 10, allAnalyzedVideos.length))
  }

  const toggleSort = () => {
    setSortDirection((prev) => (prev === "best" ? "worst" : "best"))
  }

  const toggleChannelSort = () => {
    setChannelSortDirection((prev) => (prev === "best" ? "worst" : "best"))
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <AppHeader onLoginClick={() => {}} />

      <main className="container mx-auto max-w-2xl px-4 py-6 md:px-6">
        {/* 1. ?먮뜲???レ씠???뱀뀡 (理쒖긽?? */}
        <div className="mb-6 rounded-[2rem] bg-white p-6 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)] border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-400 via-red-500 to-pink-500" />

          <div className="mb-4 flex items-center gap-2">
            <div className="p-2 rounded-full bg-orange-50 text-orange-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">?먮뜲???レ씠??3</h2>
            <Clock className="ml-auto h-5 w-5 text-slate-400" />
          </div>

          <div className="flex gap-2 mb-4 p-1 bg-slate-50 rounded-2xl">
            <button
              onClick={() => {
                setHotFilter("views")
                setSortDirection("best")
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
                hotFilter === "views"
                  ? "bg-white text-slate-900 shadow-md ring-1 ring-black/5"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              遺꾩꽍??
            </button>
            <button
              onClick={() => {
                if (hotFilter === "trust") {
                  toggleSort()
                } else {
                  setHotFilter("trust")
                  setSortDirection("best")
                }
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-1 ${
                hotFilter === "trust"
                  ? sortDirection === "worst"
                    ? "bg-white text-red-600 shadow-md ring-1 ring-black/5"
                    : "bg-white text-green-600 shadow-md ring-1 ring-black/5"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="flex items-center gap-1">
                <span>
                  {hotFilter === "trust"
                    ? sortDirection === "best"
                      ? "?좊ː??TOP 3"
                      : "?좊ː??WORST 3"
                    : "?좊ː??}
                </span>
                {hotFilter === "trust" && <ArrowUpDown className="h-3 w-3 opacity-80" />}
              </span>
            </button>
            <button
              onClick={() => {
                if (hotFilter === "aggro") {
                  toggleSort()
                } else {
                  setHotFilter("aggro")
                  setSortDirection("best")
                }
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-1 ${
                hotFilter === "aggro"
                  ? sortDirection === "worst"
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-200"
                    : "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-200"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="flex items-center gap-1">
                <span>
                  {hotFilter === "aggro" ? (
                    <>
                      ?닿렇濡?" "}
                      <span className={sortDirection === "worst" ? "text-xs tracking-tighter" : ""}>
                        {sortDirection === "best" ? "TOP 3" : "LOWEST 3"}
                      </span>
                    </>
                  ) : (
                    "?닿렇濡?
                  )}
                </span>
                {hotFilter === "aggro" && <ArrowUpDown className="h-3 w-3 opacity-80" />}
              </span>
            </button>
          </div>

          <div className="space-y-2">
            {isLoadingHotIssues ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-purple-500"></div>
              </div>
            ) : hotIssues.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                理쒓렐 24?쒓컙 ??遺꾩꽍???곸긽???놁뒿?덈떎
              </div>
            ) : (
              hotIssues.map((item) => {
                const color = item.score >= 70 ? "green" : "red"
                return (
                  <HotIssueCard 
                    key={item.id} 
                    item={{ ...item, color }} 
                    type={hotFilter === 'views' ? 'views' : hotFilter === 'trust' ? 'trust' : 'aggro'}
                    label={hotFilter === 'aggro' ? '?닿렇濡? : undefined}
                    onClick={() => router.push(`/p-result?id=${item.id}`)}
                  />
                )
              })
            )}
          </div>
        </div>

        {/* 2. ?ㅻ퉬寃뚯씠????(留덉씠?섏씠吏 援щ룄) */}
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => setActiveTab("video")}
            className={`flex-1 rounded-full text-base font-bold transition-all border shadow-sm ${
              activeTab === "video"
                ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white border-transparent shadow-md shadow-orange-200 transform scale-[1.02]"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            } ${isSearchExpanded ? "px-3 py-3 opacity-50 md:px-6 md:py-3.5" : "px-4 py-3.5 md:px-6 md:py-4"}`}
          >
            <span className={isSearchExpanded ? "md:hidden" : ""}>{isSearchExpanded ? "?곸긽" : "?곸긽 ?몃젋??}</span>
            <span className={isSearchExpanded ? "hidden md:inline" : "hidden"}>?곸긽 ?몃젋??/span>
          </button>

          {!isSearchExpanded ? (
            <button
              onClick={() => setIsSearchExpanded(true)}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
            >
              <Search className="h-5 w-5 text-slate-400 group-hover:text-slate-600" />
            </button>
          ) : (
            <div className="flex max-w-xs flex-1 items-center gap-2 rounded-full border border-blue-500 bg-white px-4 py-3 shadow-md animate-in fade-in zoom-in-95 duration-200">
              <Search className="h-5 w-5 text-slate-600 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="寃??.."
                className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 outline-none min-w-0"
                autoFocus
                onBlur={() => {
                  if (!searchQuery) setIsSearchExpanded(false)
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("")
                    setIsSearchExpanded(false)
                  }}
                  className="flex-shrink-0"
                >
                  <X className="h-5 w-5 text-slate-400" />
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => setActiveTab("channel")}
            className={`flex-1 rounded-full text-base font-bold transition-all border shadow-sm ${
              activeTab === "channel"
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-transparent shadow-md shadow-blue-200 transform scale-[1.02]"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            } ${isSearchExpanded ? "px-3 py-3 opacity-50 md:px-6 md:py-3.5" : "px-4 py-3.5 md:px-6 md:py-4"}`}
          >
            <span className={isSearchExpanded ? "md:hidden" : ""}>{isSearchExpanded ? "梨꾨꼸" : "梨꾨꼸 ?몃젋??}</span>
            <span className={isSearchExpanded ? "hidden md:inline" : "hidden"}>梨꾨꼸 ?몃젋??/span>
          </button>
        </div>

        {activeTab === "video" ? (
          <div className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">?꾩껜 遺꾩꽍 ?곸긽</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">理쒖큹 遺꾩꽍??湲곗?</span>
                <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                  {["1??, "1二쇱씪", "1媛쒖썡"].map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period as any)}
                      className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                        selectedPeriod === period
                          ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table Header */}
            <div className="mb-4 flex items-center rounded-lg bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
              <div
                className="w-12 text-center cursor-pointer flex items-center justify-center gap-1 hover:text-slate-800"
                onClick={() => handleVideoSort("date")}
              >
                ?좎쭨
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${
                    videoSortConfig.key === "date" && videoSortConfig.direction === "asc" ? "rotate-180" : ""
                  }`}
                />
              </div>
              <div className="ml-2 flex-1">?쒕ぉ / 梨꾨꼸</div>
              <div
                className="w-14 text-center cursor-pointer flex items-center justify-center gap-0.5 hover:text-slate-800"
                onClick={() => handleVideoSort("views")}
              >
                <span className="whitespace-nowrap">議고쉶??/span>
                <ChevronDown
                  className={`h-3 w-3 flex-shrink-0 transition-transform ${
                    videoSortConfig.key === "views" && videoSortConfig.direction === "asc" ? "rotate-180" : ""
                  }`}
                />
              </div>
              <div
                className="w-12 text-center cursor-pointer flex items-center justify-center gap-0.5 hover:text-slate-800 ml-1"
                onClick={() => handleVideoSort("score")}
              >
                <span className="whitespace-nowrap">?좊ː??/span>
                <ChevronDown
                  className={`h-3 w-3 flex-shrink-0 transition-transform ${
                    videoSortConfig.key === "score" && videoSortConfig.direction === "asc" ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>

            <div className="space-y-3">
              {isLoadingVideos ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-purple-500"></div>
                  <p className="text-sm text-slate-400 font-medium">?곸긽??遺덈윭?ㅻ뒗 以묒엯?덈떎...</p>
                </div>
              ) : allAnalyzedVideos.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  ?좏깮??湲곌컙 ??遺꾩꽍???곸긽???놁뒿?덈떎
                </div>
              ) : (
                allAnalyzedVideos.slice(0, displayedVideos).map((item, idx) => {
                  const dateObj = new Date(item.date);
                  const formattedDate = `${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')}`;
                  return (
                    <div key={item.id || idx} className="flex items-center gap-4">
                      <div className="w-12 flex-shrink-0 text-center">
                        <span className="text-[11px] font-bold text-slate-400 tabular-nums leading-none">
                          {formattedDate}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/p-result?id=${item.id}`} className="group/title block">
                          <h3 className="line-clamp-1 text-[13px] font-bold text-slate-800 transition-colors group-hover/title:text-blue-600">
                            {item.title}
                          </h3>
                        </Link>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <Image
                            src={item.channelIcon || "/placeholder.svg?height=12&width=12"}
                            alt=""
                            width={12}
                            height={12}
                            className="rounded-full flex-shrink-0"
                          />
                          <span className="truncate">{item.channel}</span>
                        </div>
                      </div>
                      <div className="w-14 flex-shrink-0 flex justify-center">
                        <div className="flex flex-col items-center w-full bg-blue-50/50 rounded-lg py-2 border border-blue-100/30">
                          <span className="text-sm font-black text-blue-600 tabular-nums tracking-tight leading-none">
                            {item.views}
                          </span>
                        </div>
                      </div>
                      <div className="w-12 flex-shrink-0 flex justify-center">
                        <div className={`text-xl font-black tracking-tighter tabular-nums leading-none ${item.color === "green" ? "text-green-500" : "text-red-500"}`}>
                          {item.score}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {!isInfiniteScrollEnabled && displayedVideos < allAnalyzedVideos.length && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                  異붽?濡?蹂닿린 ({allAnalyzedVideos.length - displayedVideos}媛????덉쓬)
                </button>
              </div>
            )}

            {isInfiniteScrollEnabled && displayedVideos < allAnalyzedVideos.length && (
              <div ref={observerTarget} className="mt-4 flex justify-center py-4">
                {isLoadingMore ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-purple-500"></div>
                    <span className="text-sm">濡쒕뵫 以?..</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">?ㅽ겕濡ㅽ븯???붾낫湲?/span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4 rounded-2xl bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-t-4 border-purple-500 relative">
            <div className="mb-2.5 flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              <h2 className="text-base font-bold text-slate-800">二쇨컙 ?レ콈??3</h2>
              <Clock className="ml-auto h-4 w-4 text-slate-400" />
            </div>
            <div className="flex gap-2 mb-2.5">
              <button
                onClick={() => {
                  setChannelHotFilter("views")
                  setChannelSortDirection("best")
                }}
                className={`flex-1 rounded-xl py-1.5 text-sm font-bold transition-all ${
                  channelHotFilter === "views"
                    ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-900 ring-offset-1"
                    : "bg-white text-slate-600 hover:bg-slate-50 shadow-sm ring-1 ring-slate-200"
                }`}
              >
                遺꾩꽍??
              </button>
              <button
                onClick={() => {
                  if (channelHotFilter === "trust") {
                    setChannelSortDirection((prev) => (prev === "best" ? "worst" : "best"))
                  } else {
                    setChannelHotFilter("trust")
                    setChannelSortDirection("best")
                  }
                }}
                className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  channelHotFilter === "trust"
                    ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-900 ring-offset-1"
                    : "bg-white text-slate-600 hover:bg-slate-50 shadow-sm ring-1 ring-slate-200"
                }`}
              >
                <span className="flex items-center gap-0.5">
                  <span className={channelHotFilter === "trust" ? (channelSortDirection === "best" ? "text-green-400" : "text-red-400") : ""}>
                    {channelHotFilter === "trust" ? (channelSortDirection === "best" ? "?좊ː??TOP 3" : "?좊ː??WORST 3") : "?좊ː??}
                  </span>
                  {channelHotFilter === "trust" && <ArrowUpDown className="h-3 w-3 opacity-80" />}
                </span>
              </button>
              <button
                onClick={() => {
                  if (channelHotFilter === "controversy") {
                    toggleChannelSort()
                  } else {
                    setChannelHotFilter("controversy")
                    setChannelSortDirection("best")
                  }
                }}
                className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  channelHotFilter === "controversy"
                    ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-900 ring-offset-1"
                    : "bg-white text-slate-600 hover:bg-slate-50 shadow-sm ring-1 ring-slate-200"
                }`}
              >
                <span className="flex items-center gap-0.5">
                  <span className={channelHotFilter === "controversy" ? (channelSortDirection === "worst" ? "text-green-400" : "text-red-400") : ""}>
                    {channelHotFilter === "controversy" ? (channelSortDirection === "best" ? "?닿렇濡?TOP 3" : "?닿렇濡?LOWEST 3") : "?닿렇濡?}
                  </span>
                  {channelHotFilter === "controversy" && <ArrowUpDown className="h-3 w-3 opacity-80" />}
                </span>
              </button>
            </div>
            <div className="space-y-2">
              {isLoadingHotChannels ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-purple-500"></div>
                </div>
              ) : hotChannels.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  理쒓렐 7?쇨컙 遺꾩꽍??梨꾨꼸???놁뒿?덈떎
                </div>
              ) : (
                hotChannels.map((item) => (
                  <HotChannelCard 
                    key={item.id} 
                    item={item} 
                    type={channelHotFilter} 
                    label={channelHotFilter === 'controversy' ? '?닿렇濡? : undefined}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
