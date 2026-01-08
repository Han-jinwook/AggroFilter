"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, TrendingUp, AlertTriangle, Star, Search, X } from "lucide-react"
import { AppHeader } from "@/components/c-app-header"
import { LoginModal } from "@/components/c-login-modal"

interface TAnalysisVideo {
  id: string
  date: string
  fullDate?: string // 정렬용 정밀 타임스탬프
  title: string
  channel: string
  channelIcon: string
  score: number
  rank: number | string
  totalRank: number | string
  category: string
  views?: string
}

interface TSubscribedChannel {
  id: string
  date: string
  channelName: string
  topic: string
  videoCount: number
  rankScore: number
}


type TSortOption = "date" | "trust"

export default function MyPagePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab") as "analysis" | "subscribed" | null

  // State
  const [activeTab, setActiveTab] = useState<"analysis" | "channels">("analysis")
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
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [guideCount, setGuideCount] = useState(0)

  const longPressTimerRef = useRef<NodeJS.Timeout>()
  const isLongPressRef = useRef(false)

  // Sorted Videos Logic
  const sortedVideos = useMemo(() => {
    return [...analyzedVideos].sort((a, b) => {
      if (sortBy === "date") {
        // 정밀 타임스탬프(fullDate)가 있으면 그것을 우선 사용, 없으면 기존 날짜 문자열 사용
        if (a.fullDate && b.fullDate) {
            return new Date(b.fullDate).getTime() - new Date(a.fullDate).getTime();
        }
        return b.date.localeCompare(a.date) // Fallback
      } else {
        return b.score - a.score // 신뢰도순 (높은 점수 우선)
      }
    })
  }, [analyzedVideos, sortBy])

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
          date: v.date,
          channelName: v.channel,
          topic: v.category || "기타",
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

    // Process Topics
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
      .sort((a, b) => a.avgScore - b.avgScore)
      .map(t => t.topic);

    // Process Channels
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

  // Fetch Analyzed Videos
  useEffect(() => {
    const fetchVideos = async () => {
      setIsLoadingVideos(true)
      const history = JSON.parse(localStorage.getItem('my_analysis_history') || '[]');
      const email = localStorage.getItem('userEmail');

      if (history.length === 0 && !email) {
        setAnalyzedVideos([]);
        setIsLoadingVideos(false);
        return;
      }

      try {
        const res = await fetch('/api/mypage/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ids: history,
            email: email 
          })
        });

        if (res.ok) {
          const data = await res.json();
          setAnalyzedVideos(data.videos || []);
        }
      } catch (e) {
        console.error("Failed to fetch videos", e);
      } finally {
        setIsLoadingVideos(false);
      }
    }

    // Always fetch on mount or when tab changes to analysis
    if (activeTab === 'analysis') {
      fetchVideos();
    }
  }, [activeTab]);

  // Effects
  useEffect(() => {
    if (tabParam === "subscribed") {
      setActiveTab("channels")
    } else if (tabParam === "analysis") {
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
    localStorage.setItem("userProfileImage", "") // Reset or set default if needed

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

  const handleChannelPressStart = () => {
    isLongPressRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      router.push("/p-ranking")
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

  const sortedChannels = [...channels].sort((a, b) => {
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

  return (
    <div className="min-h-screen bg-[#F8F9FC]">
      <AppHeader onLoginClick={() => setShowLoginModal(true)} />

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        {/* My Trend Insights Section */}
        <section className="mb-5">
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-indigo-600" />
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

          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            {/* Tab Headers */}
            <div className="flex border-b border-slate-100">
              <button
                onClick={() => setActiveTopicTab("trust")}
                className={`flex-1 py-4 text-center text-sm font-bold transition-colors ${
                  activeTopicTab === "trust"
                    ? "text-emerald-600 bg-emerald-50/50 border-b-2 border-emerald-500"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
              >
                신뢰도 높은 주제
              </button>
              <button
                onClick={() => setActiveTopicTab("caution")}
                className={`flex-1 py-4 text-center text-sm font-bold transition-colors ${
                  activeTopicTab === "caution"
                    ? "text-rose-600 bg-rose-50/50 border-b-2 border-rose-500"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
              >
                주의가 필요한 주제
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 relative transition-colors duration-300">
              {activeTopicTab === "trust" ? (
                <>
                  <div className="relative w-full group animate-in slide-in-from-right-4 duration-300">
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                    <div className="flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {greenTopics.length > 0 ? (
                        greenTopics.map((topic) => (
                          <span
                            key={topic}
                            className="flex-shrink-0 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold shadow-sm border border-emerald-100 whitespace-nowrap hover:scale-105 transition-transform cursor-default"
                          >
                            #{topic}
                          </span>
                        ))
                      ) : (
                         <div className="w-full text-center py-2 text-sm text-slate-400">
                            아직 신뢰도 높은 주제가 없습니다.
                         </div>
                      )}
                      <div className="w-4 flex-shrink-0" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative w-full group animate-in slide-in-from-right-4 duration-300">
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                    <div className="flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {redTopics.length > 0 ? (
                        redTopics.map((topic) => (
                          <span
                            key={topic}
                            className="flex-shrink-0 px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold shadow-sm border border-rose-100 whitespace-nowrap hover:scale-105 transition-transform cursor-default"
                          >
                            #{topic}
                          </span>
                        ))
                      ) : (
                        <div className="w-full text-center py-2 text-sm text-slate-400">
                            주의가 필요한 주제가 없습니다.
                        </div>
                      )}
                      <div className="w-4 flex-shrink-0" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <div className="z-40 mb-2 flex flex-col lg:flex-row items-center justify-between gap-2 bg-transparent transition-all py-0.5">
          <div className="flex items-center gap-2 w-full lg:w-auto flex-1 max-w-2xl transition-all duration-300 ease-in-out mb-2 lg:mb-0">
            <button
              onClick={() => setActiveTab("analysis")}
              className={`flex-1 rounded-full px-6 py-3 text-sm font-bold transition-all shadow-sm border whitespace-nowrap ${
                activeTab === "analysis"
                  ? "bg-slate-900 text-white border-transparent shadow-md"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              } ${isSearchExpanded ? "px-4 text-xs" : ""}`}
            >
              {isSearchExpanded ? "영상" : "분석 영상"}
            </button>

            {!isSearchExpanded ? (
              <button
                onClick={() => setIsSearchExpanded(true)}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <Search className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
              </button>
            ) : (
              <div className="flex flex-[2] items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 shadow-md animate-in fade-in zoom-in-95 duration-200 transition-all">
                <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목 / 채널명 검색"
                  className="flex-1 min-w-0 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
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
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>
            )}

            <button
              onClick={() => setActiveTab("channels")}
              className={`flex-1 rounded-full px-6 py-3 text-sm font-bold transition-all shadow-sm border whitespace-nowrap ${
                activeTab === "channels"
                  ? "bg-slate-900 text-white border-transparent shadow-md"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              } ${isSearchExpanded ? "px-4 text-xs" : ""}`}
            >
              {isSearchExpanded ? "채널" : "나의 채널"}
            </button>
          </div>

          {activeTab === "analysis" ? (
            <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
              <div className="flex items-center p-1 bg-white rounded-full border border-slate-200 shadow-sm">
                <button
                  onClick={() => setSortBy("date")}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                    sortBy === "date" ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  최신순
                </button>
                <button
                  onClick={() => setSortBy("trust")}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                    sortBy === "trust" ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
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
                        video.score >= 51 ? 'text-amber-500 bg-amber-50' : 
                        'text-rose-500 bg-rose-50'
                      }`}>{video.score}</span>
                    </span>
                    {/* Rank is optional in real data for now */}
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
            <div className="rounded-3xl bg-white p-4 shadow-lg border border-slate-100 relative">
              {/* Tooltip UI restored */}
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

              {/* Table Header */}
              <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2 text-xs font-medium text-slate-400 px-1">
                <button
                  onClick={() => handleSort("date")}
                  className="flex items-center gap-1 hover:text-slate-600 w-9 pl-1"
                >
                  날짜
                  <ChevronDown
                    className={`h-3 w-3 transition-colors ${sortKey === "date" ? "text-slate-800" : "text-slate-300"}`}
                  />
                </button>
                <button
                  onClick={() => handleSort("name")}
                  className="flex items-center gap-1 hover:text-slate-600 flex-1 pl-4"
                >
                  채널명
                  <ChevronDown
                    className={`h-3 w-3 transition-colors ${sortKey === "name" ? "text-slate-800" : "text-slate-300"}`}
                  />
                </button>
                <div className="ml-auto flex gap-2 pr-1">
                  <button
                    onClick={() => handleSort("topic")}
                    className="flex items-center justify-end gap-1 hover:text-slate-600 w-16"
                  >
                    주제
                    <ChevronDown
                      className={`h-3 w-3 transition-colors ${sortKey === "topic" ? "text-slate-800" : "text-slate-300"}`}
                    />
                  </button>
                  <button
                    onClick={() => handleSort("videoCount")}
                    className="flex items-center justify-end gap-1 hover:text-slate-600 w-10"
                  >
                    영상수
                    <ChevronDown
                      className={`h-3 w-3 transition-colors ${sortKey === "videoCount" ? "text-slate-800" : "text-slate-300"}`}
                    />
                  </button>
                  <button
                    onClick={() => handleSort("rankScore")}
                    className="flex items-center justify-end gap-1 hover:text-slate-600 w-10"
                  >
                    신뢰도
                    <ChevronDown
                      className={`h-3 w-3 transition-colors ${sortKey === "rankScore" ? "text-slate-800" : "text-slate-300"}`}
                    />
                  </button>
                </div>
              </div>

              {/* Channel List */}
              <div className="space-y-2">
                {sortedChannels.map((channel) => {
                  return (
                    <div key={channel.id} className="relative group">
                      {/* Channel Row */}
                      <button
                        onMouseDown={handleChannelPressStart}
                        onMouseUp={() => handleChannelPressEnd(channel.id)}
                        onMouseLeave={handleChannelPressCancel}
                        onTouchStart={handleChannelPressStart}
                        onTouchEnd={() => handleChannelPressEnd(channel.id)}
                        onTouchCancel={handleChannelPressCancel}
                        className="w-full rounded-xl bg-slate-800 p-4 text-white hover:bg-slate-700 transition-all shadow-sm hover:shadow-md active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-2">
                          {/* Date */}
                          <div className="flex flex-col text-left text-[9px] w-9 text-slate-500 leading-tight">
                            <div>{channel.date.split(".")[0]}.</div>
                            <div className="font-medium text-slate-400">
                              {channel.date.split(".")[1]}.{channel.date.split(".")[2]}
                            </div>
                          </div>

                          {/* Channel Name */}
                          <div className="flex-1 text-left text-sm font-bold truncate pr-2">{channel.channelName}</div>

                          {/* Right Side Columns */}
                          <div className="flex items-center gap-2">
                            {/* Topic */}
                            <div className="text-sm text-right w-16 truncate text-slate-300">{channel.topic}</div>

                            {/* Video Count */}
                            <div className="w-10 text-right text-sm font-medium">{channel.videoCount}</div>

                            {/* Rank Score */}
                            <div className="w-10 text-right text-sm font-bold text-amber-400">{channel.rankScore}</div>
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
                                <div className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                                  {video.date.split(".")[1]}.{video.date.split(".")[2]}
                                </div>
                                <div className="truncate text-sm font-medium text-slate-700 group-hover/video:text-blue-600 transition-colors">
                                  {video.title}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-md">
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
              <div className="mt-4 text-center text-xs font-medium text-slate-400">총 채널 수: {channels.length}</div>
            </div>
          )}
        </div>
      </main>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  )
}
