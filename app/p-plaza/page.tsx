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
import { useRouter, usePathname, useSearchParams } from "next/navigation"

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

interface TAnalyzedChannelData {
  id: string
  rank: number
  name: string
  channelIcon?: string
  topic: string
  count: number
  score: number
  color: "green" | "red"
}

export default function PlazaPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<"video" | "channel">(() => {
    const tab = searchParams.get('tab')
    if (tab === 'video' || tab === 'channel') return tab
    if (typeof window !== 'undefined') {
      const saved = window.sessionStorage.getItem('plaza_active_tab')
      if (saved === 'video' || saved === 'channel') return saved
    }
    return 'video'
  })

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'video' || tab === 'channel') {
      setActiveTab(tab)
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('plaza_active_tab', tab)
      }
    } else {
      if (typeof window !== 'undefined') {
        const saved = window.sessionStorage.getItem('plaza_active_tab')
        if (saved === 'video' || saved === 'channel') {
          setActiveTab(saved)
          return
        }
      }
      setActiveTab('video')
    }
  }, [searchParams])

  const updateTabInUrl = (tab: 'video' | 'channel') => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('plaza_active_tab', tab)
    }
    const sp = new URLSearchParams(searchParams.toString())
    if (tab === 'video') sp.delete('tab')
    else sp.set('tab', tab)

    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [hotFilter, setHotFilter] = useState<"views" | "trust" | "aggro">("views")
  const [sortDirection, setSortDirection] = useState<"best" | "worst">("best")

  const [channelHotFilter, setChannelHotFilter] = useState<"views" | "trust" | "controversy">("views")
  const [channelSortDirection, setChannelSortDirection] = useState<"best" | "worst">("best")

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPeriod, setSelectedPeriod] = useState<"1일" | "1주일" | "1개월">("1주일")

  const [allAnalyzedVideos, setAllAnalyzedVideos] = useState<TVideoData[]>([])
  const [filteredVideos, setFilteredVideos] = useState<TVideoData[]>([])
  const [displayedVideos, setDisplayedVideos] = useState(10)
  const [isLoadingVideos, setIsLoadingVideos] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)

  const [videoSortConfig, setVideoSortConfig] = useState<{
    key: "date" | "views" | "score"
    direction: "asc" | "desc"
  }>({ key: "date", direction: "desc" })

  const [hotIssues, setHotIssues] = useState<any[]>([])
  const [isLoadingHotIssues, setIsLoadingHotIssues] = useState(true)

  const [hotChannels, setHotChannels] = useState<any[]>([])
  const [isLoadingHotChannels, setIsLoadingHotChannels] = useState(true)

  const [trendingChannels, setTrendingChannels] = useState<any[]>([])
  const [isLoadingTrendingChannels, setIsLoadingTrendingChannels] = useState(true)

  const [analyzedChannels, setAnalyzedChannels] = useState<TAnalyzedChannelData[]>([])
  const [isLoadingAnalyzedChannels, setIsLoadingAnalyzedChannels] = useState(true)

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
    const fetchAnalyzedChannels = async () => {
      setIsLoadingAnalyzedChannels(true)
      try {
        const res = await fetch(`/api/plaza/channels?period=${selectedPeriod}`)
        if (res.ok) {
          const data = await res.json()
          setAnalyzedChannels(data.channels || [])
        }
      } catch (error) {
        console.error('Failed to fetch analyzed channels:', error)
      } finally {
        setIsLoadingAnalyzedChannels(false)
      }
    }
    fetchAnalyzedChannels()
  }, [selectedPeriod])

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const filtered = allAnalyzedVideos.filter(v => 
        v.title.toLowerCase().includes(query) || 
        v.channel.toLowerCase().includes(query)
      )
      setFilteredVideos(filtered)
    } else {
      setFilteredVideos(allAnalyzedVideos)
    }
  }, [searchQuery, allAnalyzedVideos])

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
    const fetchTrendingChannels = async () => {
      setIsLoadingTrendingChannels(true)
      try {
        const viewsRes = await fetch('/api/plaza/hot-channels?filter=views&direction=desc')
        const trustRes = await fetch('/api/plaza/hot-channels?filter=trust&direction=desc')
        
        if (viewsRes.ok && trustRes.ok) {
          const viewsData = await viewsRes.json()
          const trustData = await trustRes.json()
          
          console.log('Views data:', viewsData)
          console.log('Trust data:', trustData)
          
          const trending = []
          
          if (viewsData.hotChannels && viewsData.hotChannels.length > 0) {
            trending.push({ ...viewsData.hotChannels[0], type: 'views', label: '주간 분석수' })
          }
          
          if (trustData.hotChannels && trustData.hotChannels.length > 0) {
            trending.push({ ...trustData.hotChannels[0], type: 'trust', label: '최근 분석 평균' })
          }
          
          if (viewsData.hotChannels && viewsData.hotChannels.length > 1) {
            trending.push({ ...viewsData.hotChannels[1], type: 'views', label: '주간 분석수' })
          }
          
          console.log('Trending channels:', trending)
          setTrendingChannels(trending)
        }
      } catch (error) {
        console.error('Failed to fetch trending channels:', error)
      } finally {
        setIsLoadingTrendingChannels(false)
      }
    }
    fetchTrendingChannels()
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && displayedVideos < filteredVideos.length) {
          setIsLoadingMore(true)
          setTimeout(() => {
            setDisplayedVideos((prev) => Math.min(prev + 10, filteredVideos.length))
            setIsLoadingMore(false)
          }, 500)
        }
      },
      { threshold: 0.1 },
    )
    if (observerTarget.current) observer.observe(observerTarget.current)
    return () => observer.disconnect()
  }, [isLoadingMore, displayedVideos, filteredVideos.length])

  const toggleSort = () => {
    setSortDirection((prev) => (prev === "best" ? "worst" : "best"))
  }

  const toggleChannelSort = () => {
    setChannelSortDirection((prev) => (prev === "best" ? "worst" : "best"))
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <AppHeader onLoginClick={() => {}} />

      <main className="container mx-auto max-w-[var(--app-max-width)] px-3 sm:px-4 py-4 sm:py-6 md:px-6">
        {/* 1. 탭에 따라 변경되는 상단 섹션 */}
        {activeTab === 'video' ? (
          <div className="mb-4 sm:mb-6 rounded-2xl sm:rounded-[2rem] bg-white p-4 sm:p-6 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)] border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 sm:h-1.5 bg-gradient-to-r from-orange-400 via-red-500 to-pink-500" />
            <div className="mb-3 sm:mb-4 flex items-center gap-2">
              <div className="p-1.5 sm:p-2 rounded-full bg-orange-50 text-orange-600">
                <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6" />
              </div>
              <h2 className="text-base sm:text-xl font-bold text-slate-800">원데이 핫이슈 3</h2>
              <Clock className="ml-auto h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
            </div>
            <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4 p-1 bg-slate-50 rounded-xl sm:rounded-2xl">
              <button
                onClick={() => {
                  setHotFilter("views")
                  setSortDirection("best")
                }}
                className={`flex-1 rounded-lg sm:rounded-xl py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold transition-all ${
                  hotFilter === "views"
                    ? "bg-white text-slate-900 shadow-md ring-1 ring-black/5"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                분석수
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
                className={`flex-1 rounded-lg sm:rounded-xl py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold transition-all flex items-center justify-center gap-0.5 sm:gap-1 ${
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
                        ? "신뢰도 TOP 3"
                        : "신뢰도 WORST 3"
                      : "신뢰도"}
                  </span>
                  {hotFilter === "trust" && <ArrowUpDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-80" />}
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
                className={`flex-1 rounded-lg sm:rounded-xl py-2 sm:py-2.5 text-[11px] sm:text-sm font-bold transition-all flex items-center justify-center gap-0.5 sm:gap-1 ${
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
                        어그로{" "}
                        <span className={sortDirection === "worst" ? "text-xs tracking-tighter" : ""}>
                          {sortDirection === "best" ? "TOP 3" : "LOWEST 3"}
                        </span>
                      </>
                    ) : (
                      "어그로"
                    )}
                  </span>
                  {hotFilter === "aggro" && <ArrowUpDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-80" />}
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
                  최근 24시간 내 분석된 영상이 없습니다
                </div>
              ) : (
                hotIssues.map((item) => {
                  const color = item.score >= 70 ? "green" : "red"
                  return (
                    <HotIssueCard 
                      key={item.id} 
                      item={{ ...item, color }} 
                      type={hotFilter === 'views' ? 'views' : hotFilter === 'trust' ? 'trust' : 'aggro'}
                      label={hotFilter === 'aggro' ? '어그로' : undefined}
                      onClick={() => router.push(`/p-result?id=${item.id}`)}
                    />
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-2xl bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-t-4 border-purple-500 relative">
            <div className="mb-2.5 flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              <h2 className="text-base font-bold text-slate-800">주간 핫채널 3</h2>
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
                분석수
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
                    {channelHotFilter === "trust" ? (channelSortDirection === "best" ? "신뢰도 TOP 3" : "신뢰도 WORST 3") : "신뢰도"}
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
                    {channelHotFilter === "controversy" ? (channelSortDirection === "best" ? "어그로 TOP 3" : "어그로 LOWEST 3") : "어그로"}
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
                  최근 7일간 분석된 채널이 없습니다
                </div>
              ) : (
                hotChannels.map((item) => (
                  <HotChannelCard 
                    key={item.id} 
                    item={item} 
                    type={channelHotFilter} 
                    label={channelHotFilter === 'controversy' ? '어그로' : undefined}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* 2. 네비게이션 탭 */}
        <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              setActiveTab('video')
              updateTabInUrl('video')
            }}
            className={`flex-1 rounded-full text-sm sm:text-base font-bold transition-all border shadow-sm ${
              activeTab === "video"
                ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white border-transparent shadow-md shadow-purple-200 transform scale-[1.02]"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            } ${isSearchExpanded ? "px-2 py-2.5 opacity-50 sm:px-3 sm:py-3 md:px-6 md:py-3.5" : "px-3 py-3 sm:px-4 sm:py-3.5 md:px-6 md:py-4"}`}
          >
            <span className={isSearchExpanded ? "md:hidden" : ""}>{isSearchExpanded ? "영상" : "영상 트렌드"}</span>
            <span className={isSearchExpanded ? "hidden md:inline" : "hidden"}>영상 트렌드</span>
          </button>

          {!isSearchExpanded ? (
            <button
              onClick={() => setIsSearchExpanded(true)}
              className="flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
            >
              <Search className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-hover:text-slate-600" />
            </button>
          ) : (
            <div className="flex max-w-xs flex-1 items-center gap-2 rounded-full border border-slate-300 bg-white px-3 sm:px-4 py-2.5 sm:py-3 shadow-md animate-in fade-in zoom-in-95 duration-200">
              <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur()
                  }
                }}
                enterKeyHint="search"
                placeholder="검색"
                className="flex-1 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                autoFocus
                onBlur={() => {
                  if (!searchQuery) setIsSearchExpanded(false)
                }}
              />
              <button
                onClick={() => {
                  setSearchQuery("")
                  setIsSearchExpanded(false)
                }}
                className="flex-shrink-0 rounded-full p-1 hover:bg-slate-100"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setActiveTab('channel')
              updateTabInUrl('channel')
            }}
            className={`flex-1 rounded-full text-sm sm:text-base font-bold transition-all border shadow-sm ${
              activeTab === "channel"
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-transparent shadow-md shadow-blue-200 transform scale-[1.02]"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            } ${isSearchExpanded ? "px-2 py-2.5 opacity-50 sm:px-3 sm:py-3 md:px-6 md:py-3.5" : "px-3 py-3 sm:px-4 sm:py-3.5 md:px-6 md:py-4"}`}
          >
            <span className={isSearchExpanded ? "md:hidden" : ""}>{isSearchExpanded ? "채널" : "채널 트렌드"}</span>
            <span className={isSearchExpanded ? "hidden md:inline" : "hidden"}>채널 트렌드</span>
          </button>
        </div>

        {/* 3. 탭별 콘텐츠 */}
        {activeTab === "video" ? (
          <div className="rounded-2xl sm:rounded-[2rem] bg-white p-4 sm:p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">전체 분석 영상</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs text-slate-500">최초 분석일 기준</span>
                <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                  {["1일", "1주일", "1개월"].map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period as any)}
                      className={`rounded-md px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-bold transition-all ${
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

            <div className="mb-4 flex items-center rounded-lg bg-slate-50 px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-bold text-slate-500">
              <div
                className="w-10 sm:w-12 text-center cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1 hover:text-slate-800"
                onClick={() => handleVideoSort("date")}
              >
                <span className="hidden sm:inline">날짜</span>
                <span className="sm:hidden">날짜</span>
                <ChevronDown
                  className={`h-2.5 w-2.5 sm:h-3 sm:w-3 transition-transform ${
                    videoSortConfig.key === "date" && videoSortConfig.direction === "asc" ? "rotate-180" : ""
                  }`}
                />
              </div>
              <div className="ml-1 sm:ml-2 flex-1 min-w-0">제목 / 채널</div>
              <div
                className="w-10 sm:w-14 text-center cursor-pointer flex items-center justify-center gap-0.5 hover:text-slate-800"
                onClick={() => handleVideoSort("views")}
              >
                <span className="whitespace-nowrap hidden sm:inline">조회수</span>
                <span className="whitespace-nowrap sm:hidden">조회</span>
                <ChevronDown
                  className={`h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0 transition-transform ${
                    videoSortConfig.key === "views" && videoSortConfig.direction === "asc" ? "rotate-180" : ""
                  }`}
                />
              </div>
              <div
                className="w-10 sm:w-12 text-center cursor-pointer flex items-center justify-center gap-0.5 hover:text-slate-800 ml-0.5 sm:ml-1"
                onClick={() => handleVideoSort("score")}
              >
                <span className="whitespace-nowrap hidden sm:inline">신뢰도</span>
                <span className="whitespace-nowrap sm:hidden">점수</span>
                <ChevronDown
                  className={`h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0 transition-transform ${
                    videoSortConfig.key === "score" && videoSortConfig.direction === "asc" ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>

            <div className="space-y-3">
              {isLoadingVideos ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-purple-500"></div>
                  <p className="text-sm text-slate-400 font-medium">영상을 불러오는 중입니다...</p>
                </div>
              ) : allAnalyzedVideos.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  선택한 기간 내 분석된 영상이 없습니다
                </div>
              ) : (
                filteredVideos.slice(0, displayedVideos).map((item, idx) => {
                  const dateObj = new Date(item.date);
                  const formattedDate = `${String(dateObj.getMonth() + 1).padStart(2, '0')}.${String(dateObj.getDate()).padStart(2, '0')}`;
                  return (
                    <div key={item.id || idx} className="flex items-center gap-2 sm:gap-4">
                      <div className="w-10 sm:w-12 flex-shrink-0 text-center">
                        <span className="text-[9px] sm:text-[11px] font-bold text-slate-400 tabular-nums leading-none">
                          {formattedDate}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/p-result?id=${item.id}`} className="group/title block">
                          <h3 className="line-clamp-1 text-[11px] sm:text-[13px] font-bold text-slate-800 transition-colors group-hover/title:text-blue-600">
                            {item.title}
                          </h3>
                        </Link>
                        <div className="mt-0.5 sm:mt-1 flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-slate-500">
                          <Image
                            src={item.channelIcon || "/placeholder.svg?height=12&width=12"}
                            alt=""
                            width={10}
                            height={10}
                            className="rounded-full flex-shrink-0 sm:w-3 sm:h-3"
                          />
                          <span className="truncate">{item.channel}</span>
                        </div>
                      </div>
                      <div className="w-10 sm:w-14 flex-shrink-0 flex justify-center">
                        <div className="flex flex-col items-center w-full bg-blue-50/50 rounded-lg py-1 sm:py-2 border border-blue-100/30">
                          <span className="text-xs sm:text-base font-black text-blue-600 tabular-nums tracking-tight leading-none">
                            {item.views}
                          </span>
                        </div>
                      </div>
                      <div className="w-10 sm:w-12 flex-shrink-0 flex justify-center">
                        <div className={`text-base sm:text-lg font-black tracking-tighter tabular-nums leading-none ${item.color === "green" ? "text-green-500" : "text-red-500"}`}>
                          {item.score}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {displayedVideos < filteredVideos.length && (
              <div ref={observerTarget} className="mt-4 flex justify-center py-4">
                {isLoadingMore ? (
                  <div className="flex items-center gap-2 text-slate-500">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-purple-500"></div>
                    <span className="text-sm">로딩 중...</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">스크롤하여 더보기</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 지금 뜨는 채널 섹션 */}
            <div className="mb-6 rounded-2xl bg-white p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-purple-600" />
                <h2 className="text-xl font-bold text-slate-800">지금 뜨는 채널</h2>
              </div>
              {isLoadingTrendingChannels ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-purple-500"></div>
                </div>
              ) : trendingChannels.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  최근 7일간 분석된 채널이 없습니다
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {trendingChannels.map((channel, idx) => {
                    const colors = [
                      { bg: 'bg-blue-50', border: 'border-blue-100', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', textColor: 'text-blue-600' },
                      { bg: 'bg-green-50', border: 'border-green-100', iconBg: 'bg-green-100', iconColor: 'text-green-600', textColor: 'text-green-600' },
                      { bg: 'bg-amber-50', border: 'border-amber-100', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', textColor: 'text-amber-600' }
                    ]
                    const color = colors[idx] || colors[0]
                    const value = channel.type === 'views' 
                      ? channel.analysis_count 
                      : Math.round(channel.avg_reliability || 0)
                    const displayValue = channel.type === 'views' ? value : `${value}점`
                    
                    return (
                      <div key={channel.id} className={`text-center p-4 ${color.bg} rounded-xl border ${color.border}`}>
                        <div className="flex items-center justify-center mb-2">
                          <div className={`p-2 ${color.iconBg} rounded-full`}>
                            {channel.type === 'trust' ? (
                              <TrendingUp className={`h-5 w-5 ${color.iconColor}`} />
                            ) : (
                              <Activity className={`h-5 w-5 ${color.iconColor}`} />
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-slate-600 mb-1 truncate">{channel.name}</div>
                        <div className="text-sm text-slate-500">({channel.label})</div>
                        <div className={`text-2xl font-black ${color.textColor} mt-2`}>{displayValue}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 전체 분석 채널 섹션 */}
            <div className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">전체 분석 채널</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">최초 분석일 기준</span>
                  <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                    {(["1일", "1주일", "1개월"] as const).map((period) => (
                      <button
                        key={period}
                        onClick={() => setSelectedPeriod(period)}
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

              <div className="mb-4 flex items-center rounded-lg bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                <div className="w-8 text-center"></div>
                <div className="ml-2 flex-1">채널명 / 주제</div>
                <div className="w-20 text-center">분석수</div>
                <div className="w-16 text-center">신뢰도</div>
              </div>

              <div className="space-y-3">
                {isLoadingAnalyzedChannels ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-purple-500"></div>
                  </div>
                ) : analyzedChannels.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    선택한 기간 내 분석된 채널이 없습니다
                  </div>
                ) : (
                  analyzedChannels.map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      <div className="w-8 flex-shrink-0 text-center">
                        <span className="text-sm font-bold text-slate-400">{item.rank}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-800">{item.name}</h3>
                        <div className="mt-1 text-xs text-slate-500">{item.topic}</div>
                      </div>
                      <div className="w-20 flex-shrink-0 flex justify-center">
                        <div className="flex flex-col items-center w-full bg-blue-50/50 rounded-lg py-2 border border-blue-100/30">
                          <span className="text-sm font-black text-blue-600 tabular-nums tracking-tight leading-none">
                            {item.count}
                          </span>
                        </div>
                      </div>
                      <div className="w-16 flex-shrink-0 flex justify-center">
                        <div className={`text-xl font-black tracking-tighter tabular-nums leading-none ${item.color === 'green' ? 'text-green-500' : 'text-red-500'}`}>
                          {item.score}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
