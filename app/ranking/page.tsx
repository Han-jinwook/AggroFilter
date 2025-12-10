"use client"

import type React from "react"
import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AppHeader } from "@/components/app-header"

export default function ChannelRankingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromTab = searchParams.get("tab")
  const [originalSearchQuery] = useState("세계 경제")
  const [searchQuery, setSearchQuery] = useState("세계 경제")
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [hasBeenFocused, setHasBeenFocused] = useState(false)

  const channels = [
    { id: 1, rank: 1, name: "경제", avatar: "/placeholder.svg?height=40&width=40", score: 90, color: "text-green-500" },
    {
      id: 2,
      rank: 2,
      name: "세계 경제 분석",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 88,
      color: "text-green-500",
    },
    {
      id: 3,
      rank: 3,
      name: "서울경제TV",
      avatar: "/images/channel-logo.png",
      score: 75,
      color: "text-green-500",
      highlight: true,
    },
    {
      id: 4,
      rank: 4,
      name: "경제 트렌드 라이브",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 70,
      color: "text-green-500",
    },
    {
      id: 5,
      rank: 5,
      name: "경제 예측 전문가",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 65,
      color: "text-orange-500",
    },
    {
      id: 6,
      rank: 6,
      name: "경제 이슈 포커스",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 55,
      color: "text-orange-500",
    },
    {
      id: 7,
      rank: 7,
      name: "신 경제 전망",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 50,
      color: "text-red-500",
    },
    {
      id: 8,
      rank: 8,
      name: "지구촌 경제",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 48,
      color: "text-red-500",
    },
    {
      id: 9,
      rank: 9,
      name: "경제 이슈 리더존",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 45,
      color: "text-red-500",
    },
    {
      id: 10,
      rank: 10,
      name: "경제숏TV",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 41,
      color: "text-red-500",
    },
    {
      id: 11,
      rank: 11,
      name: "알뜰살뜰 경제",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 38,
      color: "text-red-500",
    },
    {
      id: 12,
      rank: 12,
      name: "경제 지식 한 페이지",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 35,
      color: "text-red-500",
    },
    {
      id: 13,
      rank: 13,
      name: "신세계 경제",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 33,
      color: "text-red-500",
    },
    {
      id: 14,
      rank: 14,
      name: "세상 모든 경제",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 29,
      color: "text-red-500",
    },
    {
      id: 15,
      rank: 15,
      name: "나만 알고싶은 경제학",
      avatar: "/placeholder.svg?height=40&width=40",
      score: 25,
      color: "text-red-500",
    },
  ]

  const topics = ["#주식", "#K팝 아이돌", "#세계 요리", "#스포츠"]

  const allTopics = [
    "세계 경제",
    "세계 요리",
    "세계 여행",
    "주식",
    "한국 주식",
    "미국 주식",
    "중국 주식",
    "K팝 아이돌",
    "K팝 댄스",
    "스포츠",
    "스포츠 분석",
    "경제",
    "경제 뉴스",
  ]

  const filteredTopics = searchQuery.trim()
    ? allTopics.filter((topic) => topic.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5)
    : []

  const toggleTooltip = (tooltipId: string) => {
    setActiveTooltip(activeTooltip === tooltipId ? null : tooltipId)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setShowSuggestions(value.trim().length > 0)
    setIsTopicDropdownOpen(false)
  }

  const handleSearchFocus = () => {
    if (!hasBeenFocused) {
      setSearchQuery("")
      setHasBeenFocused(true)
    }
    setShowSuggestions(true)
    setIsTopicDropdownOpen(false)
  }

  const handleSuggestionClick = (topic: string) => {
    setSearchQuery(topic)
    setShowSuggestions(false)
  }

  const handleTopicDropdownToggle = () => {
    setIsTopicDropdownOpen(!isTopicDropdownOpen)
    setShowSuggestions(false)
  }

  const handleSearchBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false)
      if (searchQuery.trim() === "") {
        setSearchQuery(originalSearchQuery)
        setHasBeenFocused(false)
      }
    }, 200)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="container px-4 py-6 pt-6">
        <div className="mx-auto max-w-2xl">
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
                        검색한 주제에 대한 채널들의 신뢰도 점수를 기준으로 순위를 매깁니다.
                      </p>
                      <div className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-gray-300 bg-white"></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="relative flex min-w-0 flex-1 items-center gap-1 rounded-full border-2 border-pink-400 bg-white px-3 py-1">
                <span className="text-base font-medium text-gray-400">#</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  placeholder="주제 검색..."
                  className="min-w-0 flex-1 bg-transparent px-1 text-sm font-medium text-gray-800 placeholder-gray-400 focus:outline-none"
                />
                <div className="relative -mt-2">
                  <button
                    onMouseEnter={() => setActiveTooltip("search")}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => toggleTooltip("search")}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-[11px] font-bold text-white hover:bg-slate-600"
                  >
                    ?
                  </button>
                  {activeTooltip === "search" && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border-2 border-gray-300 bg-white p-3 shadow-lg">
                      <p className="text-xs leading-relaxed text-gray-700">
                        관심 있는 주제를 검색하여 해당 분야의 채널 랭킹을 확인할 수 있습니다.
                      </p>
                      <div className="absolute -top-2 right-3 h-4 w-4 rotate-45 border-l-2 border-t-2 border-gray-300 bg-white"></div>
                    </div>
                  )}
                </div>
                {showSuggestions && filteredTopics.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-48 overflow-y-auto rounded-2xl border-2 border-pink-300 bg-white shadow-lg">
                    {filteredTopics.map((topic, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(topic)}
                        className="block w-full border-b border-gray-100 px-4 py-2.5 text-left text-sm font-medium text-gray-800 transition-colors last:border-0 hover:bg-pink-50"
                      >
                        <span className="text-pink-500">#</span> {topic}
                      </button>
                    ))}
                  </div>
                )}
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
                  <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl bg-slate-600 p-4 shadow-xl">
                    <div className="mb-3 flex items-center justify-between border-b border-slate-500 pb-2">
                      <h3 className="text-sm font-bold text-white">나의 관심 주제</h3>
                      <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      {topics.map((topic, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setSearchQuery(topic.replace("#", ""))
                            setIsTopicDropdownOpen(false)
                            setHasBeenFocused(true)
                          }}
                          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-white transition-colors hover:bg-slate-700"
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                    <div className="absolute -top-2 right-3 h-4 w-4 rotate-45 bg-slate-600"></div>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-hidden rounded-t-3xl border-x-4 border-t-4 border-blue-400 bg-white">
              <div className="grid grid-cols-[60px_1fr_100px] gap-2 bg-gradient-to-r from-blue-200 to-indigo-200 px-4 py-2">
                <div className="text-center text-sm font-bold text-gray-800">순위</div>
                <div className="text-center text-sm font-bold text-gray-800">채널명</div>
                <div className="text-center text-xs font-bold text-gray-800 whitespace-nowrap">신뢰도 점수</div>
              </div>
            </div>
            <div className="overflow-hidden rounded-b-3xl border-x-4 border-b-4 border-blue-400 bg-white">
              <div>
                {channels.map((channel) => (
                  <Link key={channel.rank} href={`/channel/${channel.id}`} className="block">
                    <div
                      className={`grid grid-cols-[60px_1fr_100px] items-center gap-2 border-b border-gray-100 px-4 py-2.5 last:border-0 cursor-pointer transition-colors ${
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
                      <div className="flex items-center justify-end gap-2 pr-2">
                        <span className={`text-base font-bold ${channel.highlight ? "text-white" : "text-gray-800"}`}>
                          {channel.score}
                        </span>
                        <span className={`text-xl ${channel.color}`}>●</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
