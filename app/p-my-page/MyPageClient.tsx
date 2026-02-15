"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, TrendingUp, AlertTriangle, Star, Search, X } from "lucide-react"
import { AppHeader } from "@/components/c-app-header"
import { LoginModal } from "@/components/c-login-modal"
import { getUserId } from "@/lib/anon"

interface TAnalysisVideo {
  id: string
  date: string
  fullDate?: string // 정렬용 정밀 타임스탬프
  title: string
  channel: string
  channelId: string
  channelIcon: string
  score: number
  rank: number | string
  totalRank: number | string
  category: string
  categoryId: number
  views?: string
}

interface TSubscribedChannel {
  id: string
  channelId: string
  date: string
  channelName: string
  topic: string
  categoryId: number
  videoCount: number
  rankScore: number
}

type TSortOption = "date" | "trust"

export default function MyPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab") as "analysis" | "subscribed" | null

  // State
  const [activeTab, setActiveTab] = useState<"analysis" | "channels">(tabParam === "subscribed" ? "channels" : "analysis")

  const switchTab = useCallback((tab: "analysis" | "channels") => {
    setActiveTab(tab)
    const tabValue = tab === "channels" ? "subscribed" : "analysis"
    router.replace(`/p-my-page?tab=${tabValue}`, { scroll: false })
  }, [router])
  const [activeTopicTab, setActiveTopicTab] = useState<"trust" | "caution">("trust")
  const [sortBy, setSortBy] = useState<TSortOption>("date")

  // Real Data State
  const [analyzedVideos, setAnalyzedVideos] = useState<TAnalysisVideo[]>([])
  const [isLoadingVideos, setIsLoadingVideos] = useState(true)

  const [sortKey, setSortKey] = useState<"date" | "name" | "topic" | "videoCount" | "rankScore">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null)

  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [guideCount, setGuideCount] = useState(0)
  const [isManageMode, setIsManageMode] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set())

  const longPressTimerRef = useRef<NodeJS.Timeout>()
  const isLongPressRef = useRef(false)

  // Sorted & Filtered Videos Logic
  const sortedVideos = useMemo(() => {
    let filtered = analyzedVideos
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(v => 
        v.title.toLowerCase().includes(query) || 
        v.channel.toLowerCase().includes(query)
      )
    }

    return filtered.sort((a, b) => {
      if (sortBy === "date") {
        if (a.fullDate && b.fullDate) {
            return new Date(b.fullDate).getTime() - new Date(a.fullDate).getTime();
        }
        return b.date.localeCompare(a.date) // Fallback
      } else {
        return b.score - a.score // 신뢰도순 (높은 점수 우선)
      }
    })
  }, [analyzedVideos, sortBy, searchQuery])

  // Derived Statistics & Data
  const { stats, greenTopics, redTopics, channels, groupedVideos } = useMemo(() => {
    if (analyzedVideos.length === 0) {
      return {
        stats: { totalChannels: 0, totalVideos: 0 },
        greenTopics: [],
        redTopics: [],
        channels: [],
        groupedVideos: {}
      }
    }

    const uniqueChannels = new Set(analyzedVideos.map(v => v.channel));
    const videoMap: { [key: string]: TAnalysisVideo[] } = {};
    const channelMap = new Map<string, TSubscribedChannel>();

    // 2. Topic Analysis
    const topicMap = new Map<string, { totalScore: number; count: number }>();

    analyzedVideos.forEach(v => {
      // Group videos
      if (!videoMap[v.channel]) videoMap[v.channel] = [];
      videoMap[v.channel].push(v);

      // Topic stats
      const topic = v.category || "기타";
      const currentTopic = topicMap.get(topic) || { totalScore: 0, count: 0 };
      topicMap.set(topic, {
        totalScore: currentTopic.totalScore + v.score,
        count: currentTopic.count + 1
      });

      // Channel stats
      const existing = channelMap.get(v.channel);
      if (!existing) {
        channelMap.set(v.channel, {
          id: v.channel,
          channelId: v.channelId,
          date: v.date,
          channelName: v.channel,
          topic: v.category || "기타",
          categoryId: v.categoryId,
          videoCount: 1,
          rankScore: v.score
        });
      } else {
        if (v.date > existing.date) existing.date = v.date;
        existing.videoCount += 1;
        existing.rankScore += v.score;
        channelMap.set(v.channel, existing);
      }
    });

    const topics = Array.from(topicMap.entries()).map(([topic, data]) => ({
      topic,
      avgScore: Math.round(data.totalScore / data.count)
    }));

    const green = topics
      .filter(t => t.avgScore >= 70)
      .sort((a, b) => b.avgScore - a.avgScore)
      .map(t => t.topic);

    const red = topics
      .filter(t => t.avgScore < 70)
      .sort((a, b) => a.avgScore - b.avgScore);

    const processedChannels = Array.from(channelMap.values()).map(c => ({
      ...c,
      rankScore: Math.round(c.rankScore / c.videoCount)
    }));

    return {
      stats: {
        totalChannels: uniqueChannels.size,
        totalVideos: analyzedVideos.length
      },
      greenTopics: green,
      redTopics: red,
      channels: processedChannels,
      groupedVideos: videoMap
    };
  }, [analyzedVideos]);

  const fetchVideos = useCallback(async () => {
    try {
      setIsLoadingVideos(true);
      const uid = getUserId();
      const res = await fetch('/api/mypage/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: uid })
      });

      if (res.ok) {
        const data = await res.json();
        console.log("Fetched analyzed videos from DB:", data.videos);
        setAnalyzedVideos(data.videos || []);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to fetch videos from API", res.status, errorData);
      }
    } catch (e) {
      console.error("Failed to fetch videos (Exception)", e);
    } finally {
      setIsLoadingVideos(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // 뒤로가기(popstate / bfcache) 시 URL에서 탭 복원 + 데이터 재로드
  useEffect(() => {
    const restoreFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      setActiveTab(tab === "subscribed" ? "channels" : "analysis");
      fetchVideos();
    };

    const handlePopState = () => restoreFromUrl();
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) restoreFromUrl();
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [fetchVideos]);

  // Next.js 클라이언트 네비게이션 뒤로가기 시 탭 동기화
  useEffect(() => {
    if (tabParam === "subscribed") {
      setActiveTab("channels")
    } else if (tabParam === "analysis" || tabParam === null) {
      setActiveTab("analysis")
    }
  }, [tabParam])

  useEffect(() => {
    const savedCount = localStorage.getItem("my-page-guide-count")
    const count = savedCount ? Number.parseInt(savedCount) : 0
    setGuideCount(count)

    if (activeTab === "channels" && count < 3) {
      const timer = setTimeout(() => {
        setShowGuide(true)
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setShowGuide(false)
    }
  }, [activeTab])

  const handleLoginSuccess = (email: string) => {
    const nickname = email.split("@")[0]
    localStorage.setItem("userNickname", nickname)
    localStorage.setItem("userEmail", email)
    localStorage.setItem("userProfileImage", "") 

    window.dispatchEvent(new CustomEvent("profileUpdated"))
    setShowLoginModal(false)
  }

  const handleCloseGuide = () => {
    const newCount = guideCount + 1
    setGuideCount(newCount)
    localStorage.setItem("my-page-guide-count", newCount.toString())
    setShowGuide(false)
  }

  const handleSort = (key: "date" | "name" | "topic" | "videoCount" | "rankScore") => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortOrder("desc")
    }
  }

  const handleChannelClick = (channelId: string) => {
    if (!isLongPressRef.current) {
      setExpandedChannelId(expandedChannelId === channelId ? null : channelId)
    }
  }

  const handleChannelPressStart = (channelId: string, categoryId?: number) => {
    isLongPressRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      const categoryParam = categoryId ? `category=${categoryId}&` : ''
      router.push(`/p-ranking?${categoryParam}channel=${channelId}`)
    }, 500)
  }

  const handleChannelPressEnd = (channelId: string) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }

    setTimeout(() => {
      if (!isLongPressRef.current) {
        handleChannelClick(channelId)
      }
      isLongPressRef.current = false
    }, 0)
  }

  const handleChannelPressCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
  }

  const sortedChannels = useMemo(() => {
    let filtered = [...channels]

    if (selectedCategory) {
      filtered = filtered.filter(c => c.topic === selectedCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c => 
        c.channelName.toLowerCase().includes(query) ||
        c.topic.toLowerCase().includes(query)
      )
    }

    return filtered.sort((a, b) => {
      let aValue: any = a[sortKey === "name" ? "channelName" : sortKey]
      let bValue: any = b[sortKey === "name" ? "channelName" : sortKey]

      if (sortKey === "videoCount" || sortKey === "rankScore") {
        aValue = Number(aValue)
        bValue = Number(bValue)
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1
      return 0
    })
  }, [channels, sortKey, sortOrder, searchQuery, selectedCategory])

  const categoryFilterStats = useMemo(() => {
    if (!selectedCategory) return null
    const vids = analyzedVideos.filter(v => (v.category || "기타") === selectedCategory)
    if (vids.length === 0) return null
    const totalScore = vids.reduce((sum, v) => sum + v.score, 0)
    return {
      videoCount: vids.length,
      avgScore: Math.round(totalScore / vids.length)
    }
  }, [analyzedVideos, selectedCategory])

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <AppHeader onLoginClick={() => setShowLoginModal(true)} />

      <main className="mx-auto max-w-[var(--app-max-width)] px-2 sm:px-4 py-4 sm:py-8 md:px-6">
        {/* My Trend Insights Section */}
        <section className="mb-3">
          <div className="flex items-end justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              나의 트렌드 인사이트
            </h2>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                분석 채널 <strong className="text-slate-900">{stats.totalChannels}</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                분석 영상 <strong className="text-slate-900">{stats.totalVideos}</strong>
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            {/* Tab Headers */}
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => setActiveTopicTab("trust")}
                className={`flex-1 py-2.5 text-center text-xs sm:text-sm font-bold transition-colors ${
                  activeTopicTab === "trust"
                    ? "text-emerald-600 bg-emerald-50/50 border-b-2 border-emerald-500"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
              >
                신뢰도 높은 카테고리
              </button>
              <button
                onClick={() => setActiveTopicTab("caution")}
                className={`flex-1 py-2.5 text-center text-xs sm:text-sm font-bold transition-colors ${
                  activeTopicTab === "caution"
                    ? "text-rose-600 bg-rose-50/50 border-b-2 border-rose-500"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
              >
                주의가 필요한 카테고리
              </button>
            </div>

            {/* Content Area */}
            <div className="p-3 relative transition-colors duration-300">
              {activeTopicTab === "trust" ? (
                <>
                  <div className="relative w-full group animate-in slide-in-from-right-4 duration-300">
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                    <div className="flex flex-nowrap gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {greenTopics.length > 0 ? (
                        greenTopics.map((topic) => (
                          <button
                            key={topic}
                            onClick={() => {
                              setSelectedCategory(topic)
                              switchTab("channels")
                            }}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold shadow-sm border whitespace-nowrap hover:scale-105 transition-all cursor-pointer ${
                              selectedCategory === topic
                                ? "bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300"
                                : "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                            }`}
                          >
                            #{topic}
                          </button>
                        ))
                      ) : (
                         <div className="w-full text-center py-2 text-sm text-slate-400">
                            아직 신뢰도 높은 카테고리가 없습니다.
                         </div>
                      )}
                      <div className="w-12 flex-shrink-0" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative w-full group animate-in slide-in-from-right-4 duration-300">
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                    <div className="flex flex-nowrap gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {redTopics.length > 0 ? (
                        redTopics.map((t) => (
                          <button
                            key={t.topic}
                            onClick={() => {
                              setSelectedCategory(t.topic)
                              switchTab("channels")
                            }}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold shadow-sm border whitespace-nowrap hover:scale-105 transition-all cursor-pointer ${
                              selectedCategory === t.topic
                                ? t.avgScore >= 50
                                  ? "bg-amber-600 text-white border-amber-600 ring-2 ring-amber-300"
                                  : "bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300"
                                : t.avgScore >= 50
                                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                  : "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100"
                            }`}
                          >
                            #{t.topic}
                          </button>
                        ))
                      ) : (
                        <div className="w-full text-center py-2 text-sm text-slate-400">
                            주의가 필요한 카테고리가 없습니다.
                        </div>
                      )}
                      <div className="w-12 flex-shrink-0" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="z-40 mb-2 flex flex-col lg:flex-row items-center justify-between gap-2 bg-transparent transition-all py-0.5">
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 w-full lg:w-auto flex-1 transition-all duration-300 ease-in-out mb-2 lg:mb-0">
            <button
              onClick={() => switchTab("analysis")}
              className={`flex-1 rounded-full px-3 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold transition-all shadow-sm border whitespace-nowrap ${
                activeTab === "analysis"
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white border-transparent shadow-md shadow-orange-200"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              } ${isSearchExpanded ? "px-3 sm:px-4" : ""}`}
            >
              {isSearchExpanded ? "영상" : <><span className="sm:hidden">영상</span><span className="hidden sm:inline">분석 영상</span></>}
            </button>

            {!isSearchExpanded ? (
              <button
                onClick={() => setIsSearchExpanded(true)}
                className="flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 group-hover:text-slate-600" />
              </button>
            ) : (
              <div className="flex flex-[2] items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 shadow-md animate-in fade-in zoom-in-95 duration-200 transition-all">
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
                  className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
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
                switchTab("channels")
                setSelectedCategory(null)
              }}
              className={`flex-1 rounded-full px-3 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold transition-all shadow-sm border whitespace-nowrap ${
                activeTab === "channels"
                  ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-transparent shadow-md shadow-blue-200"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              } ${isSearchExpanded ? "px-3 sm:px-4" : ""}`}
            >
               {isSearchExpanded ? "채널" : <><span className="sm:hidden">채널</span><span className="hidden sm:inline">나의 채널</span></>}
            </button>
            
            {activeTab === "channels" && (
              <button
                onClick={async () => {
                  if (!isManageMode) {
                    setIsManageMode(true)
                    setSelectedChannels(new Set())
                    return
                  }
                  if (selectedChannels.size === 0) {
                    setIsManageMode(false)
                    setSelectedChannels(new Set())
                    return
                  }
                  // 선택된 채널이 있으면 구독 취소 실행
                  const selectedNames = channels
                    .filter(c => selectedChannels.has(c.id))
                    .map(c => c.channelName)
                    .join(', ')
                  if (!confirm(
                    `⚠️ 다음 ${selectedChannels.size}개 채널을 구독 취소하시겠습니까?\n\n${selectedNames}\n\n해당 채널의 분석영상들에 대한 나의 구독기록이 모두 삭제되며 복구할 수 없습니다.`
                  )) return
                  try {
                    const email = localStorage.getItem('userEmail')
                    if (!email) { alert('로그인이 필요합니다.'); return }
                    const channelIdsToDelete = channels
                      .filter(c => selectedChannels.has(c.id))
                      .map(c => c.channelId)
                    const response = await fetch('/api/subscription/unsubscribe', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ channelIds: channelIdsToDelete, email })
                    })
                    if (response.ok) {
                      const data = await response.json()
                      alert(data.message || '구독이 해제되었습니다.')
                      setSelectedChannels(new Set())
                      setIsManageMode(false)
                      await fetchVideos()
                    } else {
                      alert('구독 해제에 실패했습니다.')
                    }
                  } catch (error) {
                    console.error('구독 해제 오류:', error)
                    alert('구독 해제 중 오류가 발생했습니다.')
                  }
                }}
                className={`rounded-full px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold transition-all shadow-sm border whitespace-nowrap ${
                  isManageMode
                    ? selectedChannels.size > 0
                      ? "bg-red-600 text-white border-transparent shadow-md shadow-red-200 animate-pulse"
                      : "bg-slate-500 text-white border-transparent shadow-md"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {isManageMode
                  ? selectedChannels.size > 0
                    ? `구독 취소 (${selectedChannels.size})`
                    : "취소"
                  : "구독 관리"}
              </button>
            )}
          </div>

          {activeTab === "analysis" ? (
            <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
              <div className="flex items-center p-1 bg-white rounded-full border border-slate-200 shadow-sm">
                <button
                  onClick={() => setSortBy("date")}
                  className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-200 ${
                    sortBy === "date" ? "bg-orange-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  최신순
                </button>
                <button
                  onClick={() => setSortBy("trust")}
                  className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold transition-all duration-200 ${
                    sortBy === "trust" ? "bg-orange-500 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  신뢰도순
                </button>
              </div>
            </div>
          ) : (
            <div className="hidden lg:block w-full lg:w-auto h-10" />
          )}
        </div>

        {/* Content Grid */}
        <div className={activeTab === "analysis" ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-2" : "block"}>
          {activeTab === "analysis" ? (
            isLoadingVideos ? (
                <div className="col-span-full py-20 text-center text-slate-400">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-500 mb-4"></div>
                    <p>분석 기록을 불러오는 중...</p>
                </div>
            ) : analyzedVideos.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-400">
                    <p>아직 분석한 영상이 없습니다.</p>
                    <Link href="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
                        첫 영상 분석하러 가기
                    </Link>
                </div>
            ) : (
            sortedVideos.map((video) => (
              <Link
                href={`/p-result?id=${video.id}&from=p-my-page&tab=analysis`}
                key={video.id}
                className="group relative flex flex-col overflow-hidden rounded-3xl bg-white transition-all duration-200 active:scale-[0.98] hover:-translate-y-1 hover:shadow-xl border border-slate-100 cursor-pointer p-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">{video.date}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {video.category || "기타"}
                  </span>
                </div>
                <h3 className="mb-4 text-lg font-bold leading-snug text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {video.title}
                </h3>
                <div className="flex items-end justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative h-6 w-6 overflow-hidden rounded-full bg-slate-100">
                      {video.channelIcon && video.channelIcon !== '/placeholder.svg' ? (
                        <Image
                            src={video.channelIcon}
                            alt={video.channel}
                            fill
                            className="object-cover"
                          />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-200 text-[10px] font-bold text-slate-500">
                            {(video.channel || '?').substring(0, 1)}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-slate-500 font-medium truncate max-w-[100px]">{video.channel}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1">
                      <span className="text-xs font-medium text-slate-400">신뢰도 점수</span>
                      <span className={`px-2 py-0.5 rounded-md font-bold ${
                        video.score >= 70 ? 'text-emerald-500 bg-emerald-50' : 
                        video.score >= 50 ? 'text-amber-500 bg-amber-50' : 
                        'text-rose-500 bg-rose-50'
                      }`}>{video.score}</span>
                    </span>
                    {video.rank !== '-' && (
                        <span className="text-[10px] text-slate-400 mt-1">
                        {video.rank}위 / {video.totalRank}
                        </span>
                    )}
                  </div>
                </div>
              </Link>
            ))
            )
          ) : (
            /* Channel List Table */
            <div className="rounded-3xl bg-white p-2 sm:p-4 shadow-lg border border-slate-100 relative">
              {showGuide && (
                <div className="absolute -top-24 left-1/2 transform -translate-x-1/2 z-50 w-64 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="bg-blue-600 text-white p-4 rounded-xl shadow-xl relative">
                    <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-blue-600 rotate-45"></div>
                    <p className="text-center font-bold mb-3 text-sm leading-relaxed">
                      채널명을 꾹~ 누르면
                      <br />
                      랭킹 페이지로 이동해요!
                    </p>
                    <button
                      onClick={handleCloseGuide}
                      className="w-full bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg transition-colors text-xs font-bold"
                    >
                      알겠어요 ({guideCount}/3)
                    </button>
                  </div>
                </div>
              )}

              {/* Category Filter Badge */}
              {selectedCategory && (
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className="text-xs text-slate-500 font-medium">필터:</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200">
                    #{selectedCategory}
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-indigo-200 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {sortedChannels.length}개 채널
                    {categoryFilterStats && (
                      <> · {categoryFilterStats.videoCount}개 영상 · 평균 신뢰도 <strong className={categoryFilterStats.avgScore >= 70 ? 'text-emerald-600' : categoryFilterStats.avgScore >= 50 ? 'text-amber-600' : 'text-rose-600'}>{categoryFilterStats.avgScore}점</strong></>
                    )}
                  </span>
                </div>
              )}

              {/* Table Header */}
              <div className="mb-2 flex items-center gap-1 sm:gap-2 border-b border-slate-100 pb-2 text-[10px] sm:text-xs font-medium text-slate-400 px-1">
                {isManageMode && (
                  <div className="w-6 sm:w-8 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={sortedChannels.length > 0 && sortedChannels.every(c => selectedChannels.has(c.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedChannels(new Set(sortedChannels.map(c => c.id)))
                        } else {
                          setSelectedChannels(new Set())
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>
                )}
                <button
                  onClick={() => handleSort("date")}
                  className="flex items-center gap-1 hover:text-slate-600 w-10 sm:w-11 pl-1 whitespace-nowrap"
                >
                  날짜
                  <ChevronDown
                    className={`h-3 w-3 transition-all ${sortKey === "date" ? `text-slate-800 ${sortOrder === "asc" ? "rotate-180" : ""}` : "text-slate-300"}`}
                  />
                </button>
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 hover:text-slate-600 flex-1 pl-2 sm:pl-4"
                >
                  채널명
                  <ChevronDown
                    className={`h-3 w-3 transition-all ${sortKey === "name" ? `text-slate-800 ${sortOrder === "asc" ? "rotate-180" : ""}` : "text-slate-300"}`}
                  />
                  <span className="text-slate-400 font-normal ml-2 text-[11px] sm:text-xs">구독중 {channels.length}개</span>
                </button>
                <div className="ml-auto flex gap-1 sm:gap-2 pr-1">
                  <button
                    onClick={() => handleSort("topic")}
                    className="flex items-center justify-end gap-1 hover:text-slate-600 w-20 sm:w-24"
                  >
                    카테고리
                    <ChevronDown
                      className={`h-3 w-3 transition-all ${sortKey === "topic" ? `text-slate-800 ${sortOrder === "asc" ? "rotate-180" : ""}` : "text-slate-300"}`}
                    />
                  </button>
                  <button
                    onClick={() => handleSort("videoCount")}
                    className="flex items-center justify-end gap-1 hover:text-slate-600 w-11 sm:w-12 whitespace-nowrap"
                  >
                    <span className="sm:hidden">영상</span><span className="hidden sm:inline">영상수</span>
                    <ChevronDown
                      className={`h-3 w-3 transition-all ${sortKey === "videoCount" ? `text-slate-800 ${sortOrder === "asc" ? "rotate-180" : ""}` : "text-slate-300"}`}
                    />
                  </button>
                  <button
                    onClick={() => handleSort("rankScore")}
                    className="flex items-center justify-end gap-1 hover:text-slate-600 w-11 sm:w-12 whitespace-nowrap"
                  >
                    <span className="sm:hidden">점수</span><span className="hidden sm:inline">신뢰도</span>
                    <ChevronDown
                      className={`h-3 w-3 transition-all ${sortKey === "rankScore" ? `text-slate-800 ${sortOrder === "asc" ? "rotate-180" : ""}` : "text-slate-300"}`}
                    />
                  </button>
                </div>
              </div>

              {/* Channel List */}
              <div className="space-y-1.5 sm:space-y-2">
                {sortedChannels.map((channel) => {
                  return (
                    <div key={channel.id} className="relative group">
                      <button
                        onMouseDown={isManageMode ? undefined : () => handleChannelPressStart(channel.channelId, channel.categoryId)}
                        onMouseUp={isManageMode ? undefined : () => handleChannelPressEnd(channel.id)}
                        onMouseLeave={isManageMode ? undefined : handleChannelPressCancel}
                        onTouchStart={isManageMode ? undefined : () => handleChannelPressStart(channel.channelId, channel.categoryId)}
                        onTouchEnd={isManageMode ? undefined : () => handleChannelPressEnd(channel.id)}
                        onTouchCancel={isManageMode ? undefined : handleChannelPressCancel}
                        onClick={isManageMode ? () => {
                          const newSelected = new Set(selectedChannels)
                          if (newSelected.has(channel.id)) {
                            newSelected.delete(channel.id)
                          } else {
                            newSelected.add(channel.id)
                          }
                          setSelectedChannels(newSelected)
                        } : undefined}
                        className={`w-full rounded-xl p-3 sm:p-4 text-white transition-all shadow-sm hover:shadow-md active:scale-[0.99] ${
                          isManageMode && selectedChannels.has(channel.id)
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-slate-800 hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {/* Checkbox */}
                          {isManageMode && (
                            <div className="w-6 sm:w-8 flex items-center justify-center flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={selectedChannels.has(channel.id)}
                                onChange={() => {}}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                              />
                            </div>
                          )}
                          {/* Date */}
                          <div className="flex flex-col text-left text-[8px] sm:text-[9px] w-8 sm:w-9 text-slate-500 leading-tight">
                            <div>{channel.date.split(".")[0]}.</div>
                            <div className="font-medium text-slate-400">
                              {channel.date.split(".")[1]}.{channel.date.split(".")[2]}
                            </div>
                          </div>

                          {/* Channel Name */}
                          <div className="flex-1 text-left text-xs sm:text-sm font-bold truncate pr-1 sm:pr-2">{channel.channelName}</div>

                          {/* Right Side Columns */}
                          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                            {/* Topic */}
                            <div className="text-xs sm:text-sm text-right w-20 sm:w-24 flex-shrink-0 text-slate-300">{channel.topic}</div>

                            {/* Video Count */}
                            <div className="w-11 sm:w-12 text-right text-xs sm:text-sm font-medium flex-shrink-0">{channel.videoCount}</div>

                            {/* Rank Score */}
                            <div className="w-11 sm:w-12 text-right text-xs sm:text-sm font-bold text-amber-400 flex-shrink-0">{channel.rankScore}</div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded Video List */}
                      {expandedChannelId === channel.id && groupedVideos[channel.id] && (
                        <div className="mt-2 space-y-1 rounded-xl bg-slate-50 p-2 animate-in slide-in-from-top-2 duration-200 border border-slate-100">
                          {groupedVideos[channel.id].map((video) => (
                            <Link
                              key={video.id}
                              href={`/p-result?id=${video.id}&from=p-my-page&tab=channels`}
                              className="flex items-center justify-between gap-2 rounded-lg bg-white p-3 hover:bg-slate-50 transition-colors border border-slate-100 shadow-sm group/video"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="text-[10px] sm:text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                  {video.date.split(".")[1]}.{video.date.split(".")[2]}
                                </div>
                                <div className="truncate text-xs sm:text-sm font-medium text-slate-700 group-hover/video:text-blue-600 transition-colors">
                                  {video.title}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] sm:text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-md">
                                  {video.score}점
                                </span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} onLoginSuccess={handleLoginSuccess} />
    </div>
  )
}
