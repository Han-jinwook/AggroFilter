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
import { useState, useEffect, useRef, useCallback } from "react"
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
  const [hotFilter, setHotFilter] = useState<"trust" | "aggro">("trust")
  const [sortDirection, setSortDirection] = useState<"best" | "worst">("best")

  const [channelHotFilter, setChannelHotFilter] = useState<"trust" | "controversy">("trust")
  const [channelSortDirection, setChannelSortDirection] = useState<"best" | "worst">("best")

  const [searchQuery, setSearchQuery] = useState("")
  const [searchSort, setSearchSort] = useState<"clean" | "toxic">("clean")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // 언어 관련 상태
  const [currentLanguage, setCurrentLanguage] = useState<string>('korean')
  const [availableLanguages, setAvailableLanguages] = useState<{language: string, displayName: string, channelCount: number}[]>([])
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)

  // 브라우저 언어 감지 (초기 로드 시에만)
  useEffect(() => {
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

  const [allAnalyzedVideos, setAllAnalyzedVideos] = useState<TVideoData[]>([])
  const [filteredVideos, setFilteredVideos] = useState<TVideoData[]>([])
  const [displayedVideos, setDisplayedVideos] = useState(10)
  const [isLoadingVideos, setIsLoadingVideos] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)

  const [videoSortConfig, setVideoSortConfig] = useState<{
    key: "date" | "score" | "clickbait"
    direction: "asc" | "desc"
  }>({ key: "date", direction: "desc" })

  const [hotIssues, setHotIssues] = useState<any[]>([])
  const [isLoadingHotIssues, setIsLoadingHotIssues] = useState(true)

  const [hotChannels, setHotChannels] = useState<any[]>([])
  const [isLoadingHotChannels, setIsLoadingHotChannels] = useState(true)


  const [analyzedChannels, setAnalyzedChannels] = useState<TAnalyzedChannelData[]>([])
  const [isLoadingAnalyzedChannels, setIsLoadingAnalyzedChannels] = useState(true)

  const handleVideoSort = (key: "date" | "score" | "clickbait") => {
    setVideoSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }))
  }

  useEffect(() => {
    const fetchVideos = async () => {
      setIsLoadingVideos(true)
      try {
        const res = await fetch(`/api/plaza/videos?sort=${videoSortConfig.key}&direction=${videoSortConfig.direction}`)
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
  }, [videoSortConfig])

  useEffect(() => {
    const fetchAnalyzedChannels = async () => {
      setIsLoadingAnalyzedChannels(true)
      try {
        const res = await fetch(`/api/plaza/channels`)
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
  }, [])

  const executeSearch = useCallback(async (query: string, sort: "clean" | "toxic") => {
    if (!query.trim()) {
      setHasSearched(false)
      setSearchResults([])
      return
    }
    setIsSearching(true)
    setHasSearched(true)
    try {
      const res = await fetch(`/api/plaza/search?q=${encodeURIComponent(query.trim())}&sort=${sort}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.results || [])
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (hasSearched && searchQuery.trim()) {
      executeSearch(searchQuery, searchSort)
    }
  }, [searchSort, hasSearched, searchQuery, executeSearch])

  useEffect(() => {
    if (!searchQuery) {
      setFilteredVideos(allAnalyzedVideos)
      setHasSearched(false)
      setSearchResults([])
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = allAnalyzedVideos.filter(v => 
        v.title.toLowerCase().includes(query) || 
        v.channel.toLowerCase().includes(query)
      )
      setFilteredVideos(filtered)
    }
  }, [searchQuery, allAnalyzedVideos])

  useEffect(() => {
    const fetchHotIssues = async () => {
      setIsLoadingHotIssues(true)
      try {
        let sort = hotFilter === 'trust' ? 'trust' : 'aggro'
        let direction = sortDirection === 'best' ? 'desc' : 'asc'
        const res = await fetch(`/api/plaza/hot-issues?sort=${sort}&direction=${direction}&lang=${currentLanguage}`)
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
  }, [hotFilter, sortDirection, currentLanguage])

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
              <div className="ml-auto relative">
                <button
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className="flex h-7 px-2.5 items-center justify-center gap-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-medium"
                >
                  <span>{availableLanguages.find(l => l.language === currentLanguage)?.displayName || 'Korean'}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                {showLanguageDropdown && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-40 rounded-xl bg-indigo-600 p-2 shadow-xl">
                    <div className="space-y-1">
                      {availableLanguages.map((lang) => (
                        <button
                          key={lang.language}
                          onClick={() => {
                            setCurrentLanguage(lang.language)
                            setShowLanguageDropdown(false)
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                            currentLanguage === lang.language
                              ? 'bg-indigo-700 text-white font-bold'
                              : 'text-white hover:bg-indigo-700'
                          }`}
                        >
                          <span>{lang.displayName}</span>
                          <span className="text-[10px] text-indigo-300">({lang.channelCount})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4 p-1 bg-slate-50 rounded-xl sm:rounded-2xl">
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
            <div className="space-y-1.5">
              {isLoadingHotIssues ? (
                <div className="flex items-center justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-purple-500"></div>
                </div>
              ) : hotIssues.length === 0 ? (
                <div className="flex items-center justify-center py-6 text-sm text-slate-400">
                  데이터가 없습니다
                </div>
              ) : (
                hotIssues.map((item) => {
                  const color = item.score >= 70 ? "green" : "red"
                  return (
                    <HotIssueCard 
                      key={item.id} 
                      item={{ ...item, color }} 
                      type={hotFilter === 'trust' ? 'trust' : 'aggro'}
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
                    executeSearch(searchQuery, searchSort)
                    e.currentTarget.blur()
                  }
                }}
                enterKeyHint="search"
                placeholder="키워드 검색 (예: 비트코인, 대선)"
                className="flex-1 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none min-w-0 bg-transparent"
                autoFocus
                onBlur={() => {
                  if (!searchQuery && !hasSearched) setIsSearchExpanded(false)
                }}
              />
              <button
                onClick={() => {
                  setSearchQuery("")
                  setHasSearched(false)
                  setSearchResults([])
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

        {/* 2.5 키워드 검색 결과 */}
        {hasSearched ? (
          <div className="rounded-2xl sm:rounded-[2rem] bg-white p-4 sm:p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                  &ldquo;{searchQuery}&rdquo; 검색 결과
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {isSearching ? '검색 중...' : `${searchResults.length}개의 영상`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                  <button
                    onClick={() => setSearchSort("clean")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      searchSort === "clean"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    🟢 Clean First
                  </button>
                  <button
                    onClick={() => setSearchSort("toxic")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                      searchSort === "toxic"
                        ? "bg-rose-500 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    🔴 Toxic First
                  </button>
                </div>
                <button
                  onClick={() => {
                    setSearchQuery("")
                    setHasSearched(false)
                    setSearchResults([])
                    setIsSearchExpanded(false)
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  닫기
                </button>
              </div>
            </div>

            <div className="mb-4 flex items-center rounded-lg bg-slate-50 px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-bold text-slate-500">
              <div className="w-10 sm:w-12 text-center">날짜</div>
              <div className="ml-1 sm:ml-2 flex-1 min-w-0">제목 / 채널</div>
              <div className="w-12 sm:w-14 text-center text-red-500">어그로</div>
              <div className="w-12 sm:w-14 text-center ml-0.5 sm:ml-1 text-green-500">신뢰도</div>
            </div>

            <div className="space-y-3">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-purple-500"></div>
                  <p className="text-sm text-slate-400 font-medium">DB에서 실시간 검색 중...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  &ldquo;{searchQuery}&rdquo;에 대한 분석 결과가 없습니다
                </div>
              ) : (
                searchResults.map((item: any, idx: number) => {
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
                      <div className="w-12 sm:w-14 flex-shrink-0 flex justify-center">
                        <div className={`flex flex-col items-center w-full rounded-lg py-1 sm:py-2 border ${
                          item.clickbait <= 20 ? 'bg-emerald-50/50 border-emerald-100/30' :
                          item.clickbait <= 40 ? 'bg-amber-50/50 border-amber-100/30' :
                          'bg-rose-50/50 border-rose-100/30'
                        }`}>
                          <span className={`text-xs sm:text-sm font-black tabular-nums tracking-tight leading-none ${
                            item.clickbait <= 20 ? 'text-emerald-600' :
                            item.clickbait <= 40 ? 'text-amber-600' :
                            'text-rose-600'
                          }`}>
                            {item.clickbait}
                          </span>
                        </div>
                      </div>
                      <div className="w-10 sm:w-12 flex-shrink-0 flex justify-center">
                        <div className={`text-base sm:text-lg font-black tracking-tighter tabular-nums leading-none ${item.color === "green" ? "text-green-500" : "text-red-500"}`}>
                          {item.reliability}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) :
        /* 3. 탭별 콘텐츠 */
        activeTab === "video" ? (
          <div className="rounded-2xl sm:rounded-[2rem] bg-white p-4 sm:p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">전체 분석 영상 <span className="text-sm font-normal text-slate-400 ml-1">{allAnalyzedVideos.length}개 영상</span></h2>
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
                className="w-12 sm:w-14 text-center cursor-pointer flex items-center justify-center gap-0.5 text-red-500 hover:text-red-600"
                onClick={() => handleVideoSort("clickbait")}
              >
                <span className="whitespace-nowrap">어그로</span>
                <ChevronDown
                  className={`h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0 transition-transform ${
                    videoSortConfig.key === "clickbait" && videoSortConfig.direction === "asc" ? "rotate-180" : ""
                  }`}
                />
              </div>
              <div
                className="w-12 sm:w-14 text-center cursor-pointer flex items-center justify-center gap-0.5 text-green-500 hover:text-green-600 ml-0.5 sm:ml-1"
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
                      <div className="w-12 sm:w-14 flex-shrink-0 flex justify-center">
                        <div className={`flex flex-col items-center w-full rounded-lg py-1 sm:py-2 border ${
                          item.clickbait <= 20 ? 'bg-emerald-50/50 border-emerald-100/30' :
                          item.clickbait <= 40 ? 'bg-amber-50/50 border-amber-100/30' :
                          'bg-rose-50/50 border-rose-100/30'
                        }`}>
                          <span className={`text-xs sm:text-sm font-black tabular-nums tracking-tight leading-none ${
                            item.clickbait <= 20 ? 'text-emerald-600' :
                            item.clickbait <= 40 ? 'text-amber-600' :
                            'text-rose-600'
                          }`}>
                            {item.clickbait}
                          </span>
                        </div>
                      </div>
                      <div className="w-12 sm:w-14 flex-shrink-0 flex justify-center">
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
            {/* 전체 분석 채널 섹션 */}
            <div className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-800">전체 분석 채널 <span className="text-sm font-normal text-slate-400 ml-1">{analyzedChannels.length}개 채널</span></h2>
              </div>

              <div className="mb-4 flex items-center rounded-lg bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                <div className="w-8 text-center"></div>
                <div className="ml-2 flex-1">채널명 / 주제</div>
                <div className="w-20 text-center text-red-500">어그로</div>
                <div className="w-20 text-center text-green-500">신뢰도</div>
              </div>

              <div className="space-y-3">
                {isLoadingAnalyzedChannels ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-purple-500"></div>
                  </div>
                ) : analyzedChannels.filter(ch => {
                  if (!searchQuery.trim()) return true
                  const q = searchQuery.toLowerCase()
                  return ch.name.toLowerCase().includes(q) || ch.topic.toLowerCase().includes(q)
                }).length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    {searchQuery.trim() ? `"${searchQuery}"에 대한 채널이 없습니다` : '분석된 채널이 없습니다'}
                  </div>
                ) : (
                  analyzedChannels.filter(ch => {
                    if (!searchQuery.trim()) return true
                    const q = searchQuery.toLowerCase()
                    return ch.name.toLowerCase().includes(q) || ch.topic.toLowerCase().includes(q)
                  }).map((item, idx) => (
                    <Link
                      key={item.id}
                      href={`/channel/${item.id}`}
                      className="block rounded-xl px-2 py-2 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      aria-label={`${item.name} 채널 리포트로 이동`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-8 flex-shrink-0 text-center">
                          <span className="text-sm font-bold text-slate-400">{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-slate-800">{item.name}</h3>
                          <div className="mt-1 text-xs text-slate-500">{item.topic}</div>
                        </div>
                        <div className="w-20 flex-shrink-0 flex justify-center">
                          <div className={`flex flex-col items-center w-full rounded-lg py-2 border ${
                            item.avgClickbait <= 20 ? 'bg-emerald-50/50 border-emerald-100/30' :
                            item.avgClickbait <= 40 ? 'bg-amber-50/50 border-amber-100/30' :
                            'bg-rose-50/50 border-rose-100/30'
                          }`}>
                            <span className={`text-sm font-black tabular-nums tracking-tight leading-none ${
                              item.avgClickbait <= 20 ? 'text-emerald-600' :
                              item.avgClickbait <= 40 ? 'text-amber-600' :
                              'text-rose-600'
                            }`}>
                              {item.avgClickbait}
                            </span>
                          </div>
                        </div>
                        <div className="w-20 flex-shrink-0 flex justify-center">
                          <div className={`text-xl font-black tracking-tighter tabular-nums leading-none ${item.color === 'green' ? 'text-green-500' : 'text-red-500'}`}>
                            {item.score}
                          </div>
                        </div>
                      </div>
                    </Link>
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
