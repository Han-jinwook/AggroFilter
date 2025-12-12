"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, TrendingUp, AlertTriangle, Star, Search, X } from "lucide-react"
import { AppHeader } from "@/components/c-app-header"
import { LoginModal } from "@/components/c-login-modal"

// Mock Data
const mockVideos = [
  {
    id: "1",
    date: "25.01.15",
    title: "데이타솔루션, 딥시크 쇼크 대응 산업별 AI기술 융합해 경쟁력 강화",
    channel: "서울경제TV",
    channelIcon: "/placeholder.svg",
    score: 75,
    rank: 1,
    totalRank: 5,
    views: "1.2M",
    category: "경제",
  },
  {
    id: "2",
    date: "25.02.07",
    title: "곧 컴백한다는 지드래곤의 솔로곡",
    channel: "아이돌아카이브",
    channelIcon: "/placeholder.svg",
    score: 92,
    rank: 2,
    totalRank: 5,
    views: "850K",
    category: "연예",
  },
  {
    id: "3",
    date: "25.02.06",
    title: "비트코인은 몇 송 모두에게 자비가 없다",
    channel: "비트코인 차트두우",
    channelIcon: "/placeholder.svg",
    score: 55,
    rank: 3,
    totalRank: 5,
    views: "420K",
    category: "코인",
  },
  {
    id: "4",
    date: "25.01.25",
    title: "혹백요리사 에기잘 갈데 꺼더리면 안 된다",
    channel: "백종원 PAIK JONG WON",
    channelIcon: "/placeholder.svg",
    score: 48,
    rank: 4,
    totalRank: 5,
    views: "2.1M",
    category: "요리",
  },
]

interface TAnalysisVideo {
  id: string
  date: string
  title: string
  channel: string
  channelIcon: string
  score: number
  rank: number
  totalRank: number
}

interface TSubscribedChannel {
  id: string
  date: string
  channelName: string
  topic: string
  videoCount: number
  rankScore: number
}

const mockChannels: TSubscribedChannel[] = [
  {
    id: "1",
    date: "25.02.18",
    channelName: "백종원 PAIK JONG WON",
    topic: "요리",
    videoCount: 3,
    rankScore: 85,
  },
  {
    id: "2",
    date: "25.02.18",
    channelName: "Soothing Ghibli Piano",
    topic: "일본 애니",
    videoCount: 6,
    rankScore: 92,
  },
  {
    id: "3",
    date: "25.02.18",
    channelName: "The Everyday Recipe",
    topic: "코리 블로그",
    videoCount: 5,
    rankScore: 78,
  },
  {
    id: "4",
    date: "25.02.15",
    channelName: "또마미마 Yummy Yammy",
    topic: "맛집 콘스트",
    videoCount: 7,
    rankScore: 88,
  },
  {
    id: "5",
    date: "25.02.14",
    channelName: "FOOD★STAR フードスター",
    topic: "맛집 콘스트",
    videoCount: 3,
    rankScore: 81,
  },
  {
    id: "6",
    date: "25.02.13",
    channelName: "甘党スイーツ amaito sweets",
    topic: "디저트 제작",
    videoCount: 4,
    rankScore: 90,
  },
  {
    id: "7",
    date: "25.02.12",
    channelName: "EBS 세계테마기행-메코マ마? 괴만절!",
    topic: "먹여둘 일상",
    videoCount: 10,
    rankScore: 95,
  },
]

const channelVideos: { [key: string]: TAnalysisVideo[] } = {
  "1": [
    {
      id: "v1",
      date: "25.02.05",
      title: "영상을 만든 어떤 아쿠타아아?",
      channel: "백종원 PAIK JONG WON",
      channelIcon: "/placeholder.svg",
      score: 85,
      rank: 1,
      totalRank: 3,
    },
    {
      id: "v2",
      date: "25.02.01",
      title: "[티티뉴스] 백종원 대변 맛있다빔띠다",
      channel: "백종원 PAIK JONG WON",
      channelIcon: "/placeholder.svg",
      score: 88,
      rank: 2,
      totalRank: 3,
    },
  ],
  "2": [
    {
      id: "v4",
      date: "25.02.10",
      title: "Relaxing Piano Music for Study",
      channel: "Soothing Ghibli Piano",
      channelIcon: "/placeholder.svg",
      score: 92,
      rank: 1,
      totalRank: 6,
    },
  ],
}

const greenTopics = ["경제", "과학", "역사", "다큐", "교육", "자기계발", "테크"]
const redTopics = ["코인", "가짜뉴스", "음모론", "사이버렉카", "정치선동", "루머"]

type TSortOption = "date" | "trust"

export default function MyPagePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab") as "analysis" | "subscribed" | null

  // State
  const [activeTab, setActiveTab] = useState<"analysis" | "channels">("analysis")
  const [activeTopicTab, setActiveTopicTab] = useState<"trust" | "caution">("trust")
  const [sortBy, setSortBy] = useState<TSortOption>("date")

  const [channels, setChannels] = useState(mockChannels)
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
                분석 채널 <strong className="text-slate-900">12</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                분석 영상 <strong className="text-slate-900">142</strong>
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
            <div className="p-6 h-40 flex flex-col justify-between relative transition-colors duration-300">
              {activeTopicTab === "trust" ? (
                <>
                  <div className="flex items-center gap-3 animate-in fade-in duration-300">
                    <div className="p-2 rounded-full bg-emerald-100 text-emerald-600">
                      <Star className="h-5 w-5" fill="currentColor" />
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-900">신뢰도 높은 주제</h3>
                      <p className="text-xs text-emerald-600">최근 시청한 영상 중 신뢰도가 높은 카테고리</p>
                    </div>
                  </div>
                  <div className="relative w-full group mt-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                    <div className="flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {greenTopics.map((topic) => (
                        <span
                          key={topic}
                          className="flex-shrink-0 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold shadow-sm border border-emerald-100 whitespace-nowrap hover:scale-105 transition-transform cursor-default"
                        >
                          #{topic}
                        </span>
                      ))}
                      <div className="w-4 flex-shrink-0" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 animate-in fade-in duration-300">
                    <div className="p-2 rounded-full bg-rose-100 text-rose-600">
                      <AlertTriangle className="h-5 w-5" fill="currentColor" />
                    </div>
                    <div>
                      <h3 className="font-bold text-rose-900">주의가 필요한 주제</h3>
                      <p className="text-xs text-rose-600">어그로성/낚시성 콘텐츠가 많이 발견된 카테고리</p>
                    </div>
                  </div>
                  <div className="relative w-full group mt-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
                    <div className="flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {redTopics.map((topic) => (
                        <span
                          key={topic}
                          className="flex-shrink-0 px-4 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold shadow-sm border border-rose-100 whitespace-nowrap hover:scale-105 transition-transform cursor-default"
                        >
                          #{topic}
                        </span>
                      ))}
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
            mockVideos.map((video) => (
              <Link
                href={`/p-result?id=${video.id}&from=p-my-page&tab=analysis`}
                key={video.id}
                className="group relative flex flex-col overflow-hidden rounded-3xl bg-white transition-all duration-200 active:scale-[0.98] hover:-translate-y-1 hover:shadow-xl border border-slate-100 cursor-pointer p-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-slate-400">{video.date}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {video.category}
                  </span>
                </div>
                <h3 className="mb-4 text-lg font-bold leading-snug text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {video.title}
                </h3>
                <div className="flex items-end justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative h-6 w-6 overflow-hidden rounded-full">
                      <Image
                        src={video.channelIcon || "/placeholder.svg"}
                        alt={video.channel}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <span className="text-sm text-slate-500 font-medium">{video.channel}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1">
                      <span className="text-xs font-medium text-slate-400">신뢰도 점수</span>
                      <span className="text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md">{video.score}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">
                      {video.rank}위 / {video.totalRank}
                    </span>
                  </div>
                </div>
              </Link>
            ))
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
                      {expandedChannelId === channel.id && channelVideos[channel.id] && (
                        <div className="mt-2 space-y-1 rounded-xl bg-slate-50 p-2 animate-in slide-in-from-top-2 duration-200 border border-slate-100">
                          {channelVideos[channel.id].map((video) => (
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
