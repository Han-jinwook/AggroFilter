"use client"

import type React from "react"

import { AppHeader } from "@/components/c-app-header"
import { HotIssueCard } from "@/app/p-plaza/c-plaza/hot-issue-card"
// import { FilterTabs } from "@/app/p-plaza/c-plaza/filter-tabs"
// import { TabHeader } from "@/app/p-plaza/c-plaza/tab-header"
import {
  ChevronDown,
  TrendingUp,
  Users,
  Clock,
  Activity,
  Star,
  AlertTriangle,
  ArrowUpDown,
  Search,
  X,
  Share2,
} from "lucide-react"
import Image from "next/image"
import { useState, useEffect, useRef, useMemo } from "react"
import Link from "next/link" // Link 컴포넌트 추가

// Helper interface for video data
interface TVideoData {
  date: string
  title: string
  channel: string
  views: string
  score: number
  color: "green" | "red"
}

export default function PlazaPage() {
  const [activeTab, setActiveTab] = useState<"video" | "channel">("video")
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [hotFilter, setHotFilter] = useState<"views" | "trust" | "aggro">("views")
  const [sortDirection, setSortDirection] = useState<"best" | "worst">("best")

  const [channelHotFilter, setChannelHotFilter] = useState<"views" | "trust" | "controversy">("views")
  const [channelSortDirection, setChannelSortDirection] = useState<"best" | "worst">("best")

  const [searchType, setSearchType] = useState<"video" | "topic" | "title">("video")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPeriod, setSelectedPeriod] = useState<"1일" | "1주일" | "1개월">("1주일")
  const [dateFilter, setDateFilter] = useState<"1일" | "1주일" | "1개월">("1주일")

  // 영상 리스트 상태 관리
  const [displayedVideos, setDisplayedVideos] = useState(5)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isInfiniteScrollEnabled, setIsInfiniteScrollEnabled] = useState(false)
  const observerTarget = useRef<HTMLDivElement>(null)

  const [videoSortConfig, setVideoSortConfig] = useState<{
    key: "date" | "views" | "score"
    direction: "asc" | "desc"
  }>({ key: "date", direction: "desc" })

  const handleVideoSort = (key: "date" | "views" | "score") => {
    setVideoSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }))
  }

  const allAnalyzedVideos: TVideoData[] = useMemo(
    () => [
      {
        date: "25.02.07",
        title: "곧 컴백한다는 지드래곤의 솔로곡",
        channel: "아이돌아카이브",
        views: "1,500",
        score: 85,
        color: "green",
      },
      {
        date: "25.02.07",
        title: "🚨긴급🚨 비트코인 지금 당장 사세요!!!",
        channel: "코인왕",
        views: "890",
        score: 35,
        color: "red",
      },
      {
        date: "25.02.06",
        title: "흑백요리사 에기잘 갈데 꺼더리면 안 된다",
        channel: "백종원",
        views: "2,100",
        score: 80,
        color: "green",
      },
      {
        date: "25.02.06",
        title: "충격! 이 영상 보면 인생 바뀝니다",
        channel: "클릭베이트TV",
        views: "3,400",
        score: 25,
        color: "red",
      },
      {
        date: "25.02.05",
        title: "전문가가 알려주는 투자 비법",
        channel: "경제뉴스",
        views: "560",
        score: 72,
        color: "green",
      },
      ...Array.from({ length: 20 }, (_, i) => ({
        date: `25.02.0${(i % 5) + 1}`,
        title: `추가 영상 제목 ${i + 6}`,
        channel: `채널${i + 6}`,
        views: `${(i + 1) * 150}`,
        score: 50 + (i % 50),
        color: (i % 2 === 0 ? "green" : "red") as "green" | "red",
      })),
    ],
    [],
  )

  const sortedVideos = useMemo(() => {
    const videos = [...allAnalyzedVideos]
    return videos.sort((a, b) => {
      const direction = videoSortConfig.direction === "asc" ? 1 : -1

      switch (videoSortConfig.key) {
        case "date":
          return direction * (new Date(a.date).getTime() - new Date(b.date).getTime())
        case "views":
          const viewsA = Number.parseInt(a.views.replace(/,/g, ""))
          const viewsB = Number.parseInt(b.views.replace(/,/g, ""))
          return direction * (viewsA - viewsB)
        case "score":
          return direction * (a.score - b.score)
        default:
          return 0
      }
    })
  }, [allAnalyzedVideos, videoSortConfig])

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

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [isInfiniteScrollEnabled, isLoadingMore, displayedVideos, allAnalyzedVideos.length]) // allAnalyzedVideos.length is used here, which is a stable value.

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
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => setActiveTab("video")}
            className={`flex-1 rounded-full text-base font-bold transition-all border shadow-sm ${
              activeTab === "video"
                ? "bg-slate-900 text-white border-transparent shadow-md transform scale-[1.02]"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            } ${isSearchExpanded ? "px-3 py-3 opacity-50 md:px-6 md:py-3.5" : "px-4 py-3.5 md:px-6 md:py-4"}`}
          >
            <span className={isSearchExpanded ? "md:hidden" : ""}>{isSearchExpanded ? "영상" : "영상 트렌드"}</span>
            <span className={isSearchExpanded ? "hidden md:inline" : "hidden"}>영상 트렌드</span>
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
                placeholder="검색..."
                className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 outline-none min-w-0"
                autoFocus
                onBlur={() => {
                  if (!searchQuery) {
                    setIsSearchExpanded(false)
                  }
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
                ? "bg-slate-900 text-white border-transparent shadow-md transform scale-[1.02]"
                : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            } ${isSearchExpanded ? "px-3 py-3 opacity-50 md:px-6 md:py-3.5" : "px-4 py-3.5 md:px-6 md:py-4"}`}
          >
            <span className={isSearchExpanded ? "md:hidden" : ""}>{isSearchExpanded ? "채널" : "채널 트렌드"}</span>
            <span className={isSearchExpanded ? "hidden md:inline" : "hidden"}>채널 트렌드</span>
          </button>
        </div>

        {activeTab === "video" ? (
          <>
            <div className="mb-4 rounded-[2rem] bg-white p-3 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)] border border-slate-100 relative overflow-hidden">
              {/* Decorative top gradient bar */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-400 via-red-500 to-pink-500" />

              <div className="mb-3 flex items-center gap-2">
                <div className="p-2 rounded-full bg-orange-50 text-orange-600">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">원데이 핫이슈 3</h2>
                <Clock className="ml-auto h-5 w-5 text-slate-400" />
              </div>

              <div className="flex gap-2 mb-3 p-1 bg-slate-50 rounded-2xl">
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
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-1 ${
                    hotFilter === "trust"
                      ? // Trust WORST 3 button now uses red color to match the warning sentiment
                        sortDirection === "worst"
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
                      ? // Aggro LOWEST 3 (good, low aggro) should be green, TOP 3 (bad, high aggro) should be red
                        sortDirection === "worst"
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
                    {hotFilter === "aggro" && <ArrowUpDown className="h-3 w-3 opacity-80" />}
                  </span>
                </button>
              </div>

              <div className="space-y-2">
                {hotFilter === "views" && (
                  <>
                    {[
                      {
                        id: 1,
                        rank: 1,
                        score: 92,
                        views: "1200",
                        title: "충격! 이 영상의 진실은...",
                        channel: "이슈왕",
                        topic: "이슈 분석",
                        color: "green",
                        url: "https://www.youtube.com/watch?v=example1",
                      },
                      {
                        id: 2,
                        rank: 2,
                        score: 35,
                        views: "800",
                        title: "🚨긴급🚨 지금 당장 보세요!!!",
                        channel: "사이버렉카",
                        topic: "긴급 속보",
                        color: "red",
                        url: "https://www.youtube.com/watch?v=example2",
                      },
                      {
                        id: 3,
                        rank: 3,
                        score: 78,
                        views: "500",
                        title: "전문가가 분석한 최신 트렌드",
                        channel: "경제연구소",
                        topic: "경제 전망",
                        color: "green",
                        url: "https://www.youtube.com/watch?v=example3",
                      },
                    ].map((item) => (
                      <HotIssueCard key={item.rank} item={item} type="views" />
                    ))}
                  </>
                )}

                {hotFilter === "trust" && (
                  <>
                    {sortDirection === "best"
                      ? [
                          {
                            id: 4,
                            rank: 1,
                            score: 98,
                            views: "1200",
                            title: "과학적 사실로 증명된...",
                            channel: "과학쿠키",
                            topic: "과학 탐구",
                            color: "green",
                            url: "https://www.youtube.com/watch?v=example4",
                          },
                          {
                            id: 5,
                            rank: 2,
                            score: 95,
                            views: "3400",
                            title: "논문 기반 완벽 분석",
                            channel: "지식인사이드",
                            topic: "교육 정보",
                            color: "green",
                            url: "https://www.youtube.com/watch?v=example5",
                          },
                          {
                            id: 6,
                            rank: 3,
                            score: 92,
                            views: "2100",
                            title: "팩트체크 완료",
                            channel: "뉴스공장",
                            topic: "사회 이슈",
                            color: "green",
                            url: "https://www.youtube.com/watch?v=example6",
                          },
                        ].map((item) => <HotIssueCard key={item.rank} item={item} type="trust" />)
                      : [
                          {
                            id: 7,
                            rank: 1,
                            score: 12,
                            views: "5600",
                            title: "절대 믿지 마세요",
                            channel: "가짜뉴스판독기",
                            topic: "정치 비평",
                            color: "red",
                            url: "https://www.youtube.com/watch?v=example7",
                          },
                          {
                            id: 8,
                            rank: 2,
                            score: 15,
                            views: "8900",
                            title: "가짜뉴스의 실체",
                            channel: "음모론타파",
                            topic: "사회 이슈",
                            color: "red",
                            url: "https://www.youtube.com/watch?v=example8",
                          },
                          {
                            id: 9,
                            rank: 3,
                            score: 22,
                            views: "4200",
                            title: "조작된 증거들",
                            channel: "팩트사냥꾼",
                            topic: "화제 이슈",
                            color: "red",
                            url: "https://www.youtube.com/watch?v=example9",
                          },
                        ].map((item) => <HotIssueCard key={item.rank} item={item} type="trust" />)}
                  </>
                )}

                {hotFilter === "aggro" && (
                  <>
                    {sortDirection === "best"
                      ? [
                          {
                            id: 10,
                            rank: 1,
                            score: 90,
                            views: "4500",
                            title: "썸네일 낚시 레전드",
                            channel: "어그로대장",
                            topic: "예능 분석",
                            color: "red",
                            url: "https://www.youtube.com/watch?v=example10",
                          },
                          {
                            id: 11,
                            rank: 2,
                            score: 85,
                            views: "3200",
                            title: "제목이랑 내용 다름",
                            channel: "낚시꾼",
                            topic: "화제 이슈",
                            color: "red",
                            url: "https://www.youtube.com/watch?v=example11",
                          },
                          {
                            id: 12,
                            rank: 3,
                            score: 80,
                            views: "2800",
                            title: "충격적인 진실??",
                            channel: "미스터리",
                            topic: "미스터리 썰",
                            color: "red",
                            url: "https://www.youtube.com/watch?v=example12",
                          },
                        ].map((item) => <HotIssueCard key={item.rank} item={item} type="aggro" label="어그로" />)
                      : [
                          {
                            id: 13,
                            rank: 1,
                            score: 12,
                            views: "1200",
                            title: "정직한 제목 정직한 내용",
                            channel: "클린유튜버",
                            topic: "제품 리뷰",
                            color: "green",
                            url: "https://www.youtube.com/watch?v=example13",
                          },
                          {
                            id: 14,
                            rank: 2,
                            score: 15,
                            views: "2500",
                            title: "담백한 분석",
                            channel: "정보통",
                            topic: "생활 정보",
                            color: "green",
                            url: "https://www.youtube.com/watch?v=example14",
                          },
                          {
                            id: 15,
                            rank: 3,
                            score: 18,
                            views: "1800",
                            title: "과장 없는 팩트",
                            channel: "팩트체크",
                            topic: "뉴스 해설",
                            color: "green",
                            url: "https://www.youtube.com/watch?v=example15",
                          },
                        ].map((item) => <HotIssueCard key={item.rank} item={item} type="aggro" label="어그로" />)}
                  </>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">전체 분석 영상</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">최초 분석일 기준</span>
                  <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                    {["1일", "1주일", "1개월"].map((period) => (
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

              {/* Table Header */}
              <div className="mb-4 flex items-center rounded-lg bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                <div
                  className="w-12 text-center cursor-pointer flex items-center justify-center gap-1 hover:text-slate-800"
                  onClick={() => handleVideoSort("date")}
                >
                  날짜
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${
                      videoSortConfig.key === "date" && videoSortConfig.direction === "asc" ? "rotate-180" : ""
                    }`}
                  />
                </div>
                <div className="ml-2 flex-1">제목 / 채널</div>
                <div
                  className="w-16 text-center cursor-pointer flex items-center justify-center gap-1 hover:text-slate-800"
                  onClick={() => handleVideoSort("views")}
                >
                  조회수
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${
                      videoSortConfig.key === "views" && videoSortConfig.direction === "asc" ? "rotate-180" : ""
                    }`}
                  />
                </div>
                <div
                  className="w-12 text-center cursor-pointer flex items-center justify-center gap-1 hover:text-slate-800"
                  onClick={() => handleVideoSort("score")}
                >
                  신뢰도
                  <ChevronDown
                    className={`h-3 w-3 transition-transform ${
                      videoSortConfig.key === "score" && videoSortConfig.direction === "asc" ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {sortedVideos.slice(0, displayedVideos).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center rounded-2xl border border-slate-100 bg-white p-3 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex flex-col text-center text-xs text-slate-600 w-12">
                      <div className="font-mono font-bold tracking-tighter text-slate-500">
                        {item.date.split(".")[1]}.{item.date.split(".")[2]}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 ml-2">
                      <Link
                        href={`/result?id=${idx + 1}`} // Using idx for now as placeholder ID
                        className="text-sm font-semibold text-slate-800 line-clamp-1 mb-0.5 hover:text-purple-600 hover:underline decoration-purple-400 decoration-2 underline-offset-2 tracking-tight"
                      >
                        {item.title}
                      </Link>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Image
                          src="/placeholder.svg?height=12&width=12"
                          alt=""
                          width={12}
                          height={12}
                          className="rounded-full"
                        />
                        <span className="truncate">{item.channel}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center w-16 bg-blue-100 rounded-lg p-1 border border-blue-300">
                      <Users className="h-3 w-3 text-blue-600 mb-0.5" />
                      <span className="text-sm font-bold text-blue-700 tabular-nums tracking-tight">{item.views}</span>
                    </div>

                    <div
                      className={`text-2xl font-black tracking-tighter tabular-nums w-12 text-center ${
                        item.color === "green" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {item.score}
                    </div>
                  </div>
                ))}
              </div>

              {!isInfiniteScrollEnabled && displayedVideos < allAnalyzedVideos.length && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                  >
                    추가로 보기 ({allAnalyzedVideos.length - displayedVideos}개 더 있음)
                  </button>
                </div>
              )}

              {isInfiniteScrollEnabled && displayedVideos < allAnalyzedVideos.length && (
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

              {isInfiniteScrollEnabled && displayedVideos >= allAnalyzedVideos.length && (
                <div className="mt-4 text-center text-sm text-slate-400">모든 영상을 불러왔습니다</div>
              )}
            </div>
          </>
        ) : (
          <>
            <>
              <div className="mb-4 rounded-2xl bg-white p-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-t-4 border-gradient-to-r from-purple-500 to-blue-500">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 rounded-t-2xl" />

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
                    className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1 tracking-tight ${
                      channelHotFilter === "trust"
                        ? // When channelHotFilter is 'trust', the background is always dark.
                          // The text color changes based on sortDirection.
                          "bg-slate-900 text-white shadow-md ring-2 ring-slate-900 ring-offset-1"
                        : "bg-white text-slate-600 hover:bg-slate-50 shadow-sm ring-1 ring-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-0.5">
                      <span
                        className={
                          channelHotFilter === "trust"
                            ? channelSortDirection === "best"
                              ? "text-green-400" // Top 3 (Good)
                              : "text-red-400" // Worst 3 (Bad)
                            : ""
                        }
                      >
                        {channelHotFilter === "trust"
                          ? channelSortDirection === "best"
                            ? "신뢰도 TOP 3"
                            : "신뢰도 WORST 3"
                          : "신뢰도"}
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
                    className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1 tracking-tighter ${
                      channelHotFilter === "controversy"
                        ? channelSortDirection === "best"
                          ? "bg-slate-900 text-white shadow-md ring-2 ring-slate-900 ring-offset-1"
                          : "bg-slate-900 text-white shadow-md ring-2 ring-slate-900 ring-offset-1"
                        : "bg-white text-slate-600 hover:bg-slate-50 shadow-sm ring-1 ring-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-0.5">
                      <span
                        className={
                          channelHotFilter === "controversy" && channelSortDirection === "worst"
                            ? "text-green-400" // Lowest 3 (Good, low controversy)
                            : channelHotFilter === "controversy"
                              ? "text-red-400" // Top 3 (Bad, high controversy)
                              : ""
                        }
                      >
                        {channelHotFilter === "controversy"
                          ? channelSortDirection === "best"
                            ? "어그로 TOP 3"
                            : "어그로 LOWEST 3"
                          : "어그로"}
                      </span>
                      {channelHotFilter === "controversy" && <ArrowUpDown className="h-3 w-3 opacity-80" />}
                    </span>
                  </button>
                </div>

                <div className="space-y-2">
                  {channelHotFilter === "views" && (
                    <>
                      {[
                        {
                          id: 101,
                          rank: 1,
                          name: "슈카월드",
                          topic: "경제 인터뷰",
                          value: "152",
                          color: "blue",
                        },
                        {
                          id: 102,
                          rank: 2,
                          name: "과학쿠키",
                          topic: "과학 탐구",
                          value: "128",
                          color: "blue",
                        },
                        {
                          id: 103,
                          rank: 3,
                          name: "침착맨",
                          topic: "게임 엔터",
                          value: "95",
                          color: "blue",
                        },
                      ].map((item) => (
                        <HotChannelCard key={item.rank} item={item} type="views" />
                      ))}
                    </>
                  )}

                  {channelHotFilter === "trust" && (
                    <>
                      {channelSortDirection === "best"
                        ? [
                            {
                              id: 104,
                              rank: 1,
                              name: "과학쿠키",
                              topic: "과학 탐구",
                              value: "98",
                              color: "green",
                            },
                            {
                              id: 105,
                              rank: 2,
                              name: "의사양파",
                              topic: "의학 정보",
                              value: "95",
                              color: "green",
                            },
                            {
                              id: 106,
                              rank: 3,
                              name: "법률방송",
                              topic: "법률 해설",
                              value: "92",
                              color: "green",
                            },
                          ].map((item) => <HotChannelCard key={item.rank} item={item} type="trust" />)
                        : [
                            {
                              id: 107,
                              rank: 1,
                              name: "사이버렉카",
                              topic: "화제 이슈",
                              value: "12",
                              color: "red",
                            },
                            {
                              id: 108,
                              rank: 2,
                              name: "가짜뉴스TV",
                              topic: "정치 비평",
                              value: "15",
                              color: "red",
                            },
                            {
                              id: 109,
                              rank: 3,
                              name: "음모론방송",
                              topic: "미스터리 썰",
                              value: "22",
                              color: "red",
                            },
                          ].map((item) => <HotChannelCard key={item.rank} item={item} type="trust" />)}
                    </>
                  )}

                  {channelHotFilter === "controversy" && (
                    <>
                      {channelSortDirection === "best"
                        ? [
                            {
                              id: 110,
                              rank: 1,
                              name: "사이버렉카",
                              views: "120",
                              topic: "연예 이슈",
                              score: 95,
                              color: "red",
                            },
                            {
                              id: 111,
                              rank: 2,
                              name: "음모론자",
                              views: "85",
                              topic: "미스터리",
                              score: 92,
                              color: "red",
                            },
                            {
                              id: 112,
                              rank: 3,
                              name: "어그로킹",
                              views: "72",
                              topic: "정치 비평",
                              score: 88,
                              color: "red",
                            },
                          ].map((item) => (
                            <HotChannelCard key={item.rank} item={item} type="controversy" label="어그로" />
                          ))
                        : [
                            {
                              id: 113,
                              rank: 1,
                              name: "팩트체크",
                              views: "95",
                              topic: "뉴스 해설",
                              score: 12,
                              color: "green",
                            },
                            {
                              id: 114,
                              rank: 2,
                              name: "과학쿠키",
                              views: "98",
                              topic: "과학 탐구",
                              score: 15,
                              color: "green",
                            },
                            {
                              id: 115,
                              rank: 3,
                              name: "법률방송",
                              views: "92",
                              topic: "법률 해설",
                              score: 18,
                              color: "green",
                            },
                          ].map((item) => (
                            <HotChannelCard key={item.rank} item={item} type="controversy" label="어그로" />
                          ))}
                    </>
                  )}
                </div>
              </div>

              <div className="mb-6 rounded-3xl border-4 border-purple-400 bg-gradient-to-br from-purple-50 to-blue-50 p-4 shadow-lg">
                <div className="mb-3 flex items-center gap-2">
                  <Activity className="h-6 w-6 text-purple-600" />
                  <h2 className="text-lg font-bold text-purple-700">지금 뜨는 채널</h2>
                  <Clock className="ml-auto h-5 w-5 text-purple-500" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: 201,
                      label: "최다 분석",
                      name: "슈카월드",
                      topic: "경제 인터뷰",
                      value: "145",
                      subLabel: "회",
                      icon: Users,
                      color: "blue",
                    },
                    {
                      id: 202,
                      label: "최소 어그로성",
                      name: "과학쿠키",
                      topic: "과학 탐구",
                      value: "8점",
                      subLabel: "분석수 32",
                      icon: AlertTriangle,
                      color: "green",
                    },
                    {
                      id: 203,
                      label: "최고 신뢰",
                      name: "의사양파",
                      topic: "의학 정보",
                      value: "98점",
                      subLabel: "분석수 28",
                      icon: Star,
                      color: "green",
                    },
                  ].map((item, idx) => (
                    <Link
                      href={`/channel/${item.id}`}
                      key={idx}
                      className="flex flex-col items-center rounded-2xl bg-white p-3 shadow-md text-center border-2 border-slate-100 hover:scale-[1.02] transition-transform cursor-pointer"
                    >
                      <div className="text-xs font-bold text-slate-500 mb-2">{item.label}</div>
                      <div
                        className={`mb-2 rounded-full p-2 ${
                          item.color === "blue"
                            ? "bg-blue-100 text-blue-600"
                            : item.color === "green"
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600"
                        }`}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-bold text-slate-800 line-clamp-1 w-full mb-0.5">{item.name}</div>
                      <div className="text-[10px] text-slate-400 mb-1">({item.topic})</div>
                      <div className="flex items-baseline justify-center gap-1 mt-1">
                        <span
                          className={`text-lg font-black ${
                            item.color === "blue"
                              ? "text-blue-600"
                              : item.color === "green"
                                ? "text-green-600"
                                : "text-red-600"
                          }`}
                        >
                          {item.value}
                        </span>
                        <span className="text-[10px] text-slate-400">{item.subLabel}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mb-6 flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm border border-slate-100">
                <div className="flex shrink-0 rounded-xl bg-slate-100 p-1">
                  <button
                    onClick={() => setSearchType("title")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-all ${
                      searchType === "title"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    채널명
                  </button>
                  <button
                    onClick={() => setSearchType("topic")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold transition-all ${
                      searchType === "topic"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    주제
                  </button>
                </div>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={searchType === "title" ? "채널명으로 검색..." : "주제로 검색 (예: 경제, 정치, 엔터)"}
                    className="w-full rounded-xl border-2 border-blue-100 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="rounded-3xl border-2 border-blue-300 bg-white p-4 shadow-lg">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-800 tracking-tight">전체 분석 채널</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">최초 분석일 기준</span>
                    <div className="flex rounded-lg bg-slate-100 p-1">
                      {["1일", "1주일", "1개월"].map((period) => (
                        <button
                          key={period}
                          onClick={() => setDateFilter(period)}
                          className={`rounded-md px-2 py-1 text-xs font-bold transition-all ${
                            dateFilter === period
                              ? "bg-slate-800 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Table Header */}
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-100 p-3 text-xs font-semibold text-slate-500">
                  <button className="flex w-12 justify-center items-center gap-1 hover:text-slate-800 transition-colors">
                    순위
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <div className="flex-1 ml-2 pl-1">채널명 / 주제</div>
                  <button className="flex items-center justify-center gap-1 w-16 hover:text-slate-800 transition-colors">
                    분석수
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button className="flex items-center justify-center gap-1 w-12 hover:text-slate-800 transition-colors">
                    신뢰도
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                <div className="space-y-2">
                  {[
                    { rank: 1, id: 301, name: "슈카월드", category: "경제", analysis: 145, score: 88, color: "green" },
                    {
                      rank: 2,
                      id: 302,
                      name: "김작가 TV",
                      category: "인터뷰",
                      analysis: 120,
                      score: 65,
                      color: "orange",
                    },
                    {
                      rank: 3,
                      id: 303,
                      name: "가로세로연구소",
                      category: "정치",
                      analysis: 98,
                      score: 32,
                      color: "red",
                    },
                    { rank: 4, id: 304, name: "침착맨", category: "엔터", analysis: 85, score: 92, color: "green" },
                    { rank: 5, id: 305, name: "피식대학", category: "개그", analysis: 72, score: 85, color: "green" },
                  ].map((item) => (
                    <Link
                      key={item.rank}
                      href={`/channel/${item.id}`}
                      className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 transition-all hover:bg-blue-50 hover:shadow-md"
                    >
                      <div className="flex w-12 items-center justify-center text-base font-mono font-semibold text-slate-600 tabular-nums tracking-tight">
                        {item.rank}
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5 ml-2">
                        <div className="text-sm font-semibold text-slate-800 tracking-tight">{item.name}</div>
                        <div className="text-xs text-slate-500">{item.category}</div>
                      </div>
                      <div className="flex w-16 items-center justify-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-center">
                        <Activity className="h-3 w-3 text-blue-600" />
                        <span className="text-sm font-bold text-blue-600 tabular-nums tracking-tight">
                          {item.analysis}
                        </span>
                      </div>
                      <div className="flex w-12 items-center justify-center">
                        <span
                          className={`text-xl font-bold tabular-nums tracking-tighter ${
                            item.color === "green"
                              ? "text-green-500"
                              : item.color === "orange"
                                ? "text-orange-500"
                                : "text-red-500"
                          }`}
                        >
                          {item.score}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-4 flex justify-center">
                  <button className="px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105">
                    추가로 보기 (20개 더 있음)
                  </button>
                </div>
              </div>
            </>
          </>
        )}
      </main>
    </div>
  )
}


