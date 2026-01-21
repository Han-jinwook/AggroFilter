"use client"

import type React from "react"
import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AppHeader } from "@/components/c-app-header"

interface TChannel {
  id: string
  rank: number
  name: string
  avatar: string
  score: number
  color: string
  highlight?: boolean
}

export default function RankingClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromTab = searchParams.get("tab")
  
  const currentTopic = searchParams.get("topic") || ""
  
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false)
  const [availableTopics, setAvailableTopics] = useState<string[]>([])
  
  const [channels, setChannels] = useState<TChannel[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const res = await fetch('/api/topics')
        if (res.ok) {
          const data = await res.json()
          setAvailableTopics(data.topics || [])
        }
      } catch (error) {
        console.error("Failed to fetch topics:", error)
      }
    }
    fetchTopics()
  }, [])

  useEffect(() => {
    const fetchChannels = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/ranking?query=${encodeURIComponent(currentTopic)}`)
        if (res.ok) {
          const data = await res.json()
          const formatted = data.channels.map((c: any) => ({
            id: c.id,
            rank: c.rank,
            name: c.name,
            avatar: c.avatar,
            score: c.score,
            color: c.score >= 70 ? "text-green-500" : c.score >= 50 ? "text-orange-500" : "text-red-500",
            highlight: false
          }))
          setChannels(formatted)
        }
      } catch (error) {
        console.error("Failed to fetch ranking:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchChannels()
  }, [currentTopic])

  const toggleTooltip = (tooltipId: string) => {
    setActiveTooltip(activeTooltip === tooltipId ? null : tooltipId)
  }

  const handleTopicDropdownToggle = () => {
    setIsTopicDropdownOpen(!isTopicDropdownOpen)
  }

  const handleTopicClick = (topic: string) => {
    router.push(`/p-ranking?topic=${encodeURIComponent(topic)}`)
    setIsTopicDropdownOpen(false)
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
                  {currentTopic || "전체"}
                </span>
                <div className="relative -mt-2">
                  <button
                    onMouseEnter={() => setActiveTooltip("topic")}
                    onMouseLeave={() => setActiveTooltip(null)}
                    onClick={() => toggleTooltip("topic")}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-[11px] font-bold text-white hover:bg-slate-600"
                  >
                    ?
                  </button>
                  {activeTooltip === "topic" && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border-2 border-gray-300 bg-white p-3 shadow-lg">
                      <p className="text-xs leading-relaxed text-gray-700">
                        분석된 영상의 카테고리입니다. 이 카테고리에 대해 높은 신뢰도를 가진 채널 순위를 보여줍니다.
                      </p>
                      <div className="absolute -top-2 right-3 h-4 w-4 rotate-45 border-l-2 border-t-2 border-gray-300 bg-white"></div>
                    </div>
                  )}
                </div>
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
                  <div className="absolute right-0 top-full z-30 mt-2 w-56 max-h-80 overflow-y-auto rounded-2xl bg-slate-600 p-4 shadow-xl custom-scrollbar">
                    <div className="mb-3 flex items-center justify-between border-b border-slate-500 pb-2">
                      <h3 className="text-sm font-bold text-white">나의 관심 카테고리</h3>
                      <button onClick={() => setIsTopicDropdownOpen(false)}>
                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                    </div>
                    <div className="space-y-2">
                      {availableTopics.length > 0 ? (
                        availableTopics.map((topic, index) => (
                          <button
                            key={index}
                            onClick={() => handleTopicClick(topic)}
                            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-white transition-colors hover:bg-slate-700"
                          >
                            #{topic}
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-gray-300 text-center py-4">등록된 카테고리가 없습니다.</p>
                      )}
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
            <div className="overflow-hidden rounded-b-3xl border-x-4 border-b-4 border-blue-400 bg-white min-h-[300px]">
              {isLoading ? (
                <div className="flex h-[300px] w-full flex-col items-center justify-center gap-3 text-slate-400">
                   <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500"></div>
                   <p className="text-sm font-medium">채널 데이터를 분석하고 있습니다...</p>
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
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
