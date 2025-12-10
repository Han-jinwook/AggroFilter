"use client"

import { Badge } from "@/components/ui/badge"
import { ArrowLeft, TrendingUp, CheckCircle2, ChevronDown, ChevronUp, Play, ExternalLink, Share2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent } from "@/components/ui/card"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { AppHeader } from "@/components/app-header" // Import AppHeader

const TrendChart = ({ data, color }: { data: number[]; color: string }) => {
  if (!data || data.length === 0) return null

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const height = 40
  const width = 100

  const points = data
    .map((val, i) => {
      const x = data.length > 1 ? (i / (data.length - 1)) * width : width / 2
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <path
        d={`M ${points}`}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ChannelPage({ params }: { params: { id: string } }) {
  const channelData = {
    id: params.id,
    name: "슈카월드",
    subscribers: "320만",
    totalAnalysis: 145,
    profileImage: "/channel-profile.jpg", // Updated channel profile image
    trustScore: 88,
    trustGrade: "High", // High, Medium, Low
    stats: {
      accuracy: 94,
      aggro: "Low",
      trend: "Rising", // Rising, Stable, Falling
      trendData: [82, 84, 83, 85, 86, 88, 88], // Mock data for chart
    },
    topics: [
      {
        id: "economy",
        name: "국제 경제",
        rankPercent: 1, // Top 1%
        rank: 3, // Added rank
        totalChannels: 21, // Added total channels
        count: 85,
        score: 92,
        videos: [
          {
            id: 1,
            title: "미국 금리 인하, 한국 경제에 미칠 영향은?",
            date: "25.02.15",
            score: 95,
            thumbnail: "/placeholder.svg?height=60&width=106",
            views: "120만",
          },
          {
            id: 2,
            title: "엔비디아 주가 폭락의 진실",
            date: "25.02.10",
            score: 90,
            thumbnail: "/placeholder.svg?height=60&width=106",
            views: "85만",
          },
          {
            id: 3,
            title: "중국 경제 위기설 팩트체크",
            date: "25.02.01",
            score: 88,
            thumbnail: "/placeholder.svg?height=60&width=106",
            views: "50만",
          },
          {
            id: 4,
            title: "비트코인 반감기 분석",
            date: "25.01.28",
            score: 91,
            thumbnail: "/placeholder.svg?height=60&width=106",
            views: "200만",
          },
        ],
      },
      {
        id: "society",
        name: "사회 이슈",
        rankPercent: 5,
        rank: 8, // Added rank
        totalChannels: 142, // Added total channels
        count: 42,
        score: 85,
        videos: [
          {
            id: 5,
            title: "저출산 문제, 해법은 없는가",
            date: "25.02.12",
            score: 89,
            thumbnail: "/placeholder.svg?height=60&width=106",
            views: "90만",
          },
          {
            id: 6,
            title: "청년 실업률의 충격적 실태",
            date: "25.01.15",
            score: 82,
            thumbnail: "/placeholder.svg?height=60&width=106",
            views: "75만",
          },
        ],
      },
      {
        id: "history",
        name: "역사",
        rankPercent: 12,
        rank: 15, // Added rank
        totalChannels: 110, // Added total channels
        count: 18,
        score: 78,
        videos: [
          {
            id: 7,
            title: "로마 제국의 멸망 원인 3가지",
            date: "24.12.20",
            score: 80,
            thumbnail: "/placeholder.svg?height=60&width=106",
            views: "40만",
          },
          {
            id: 8,
            title: "세계사 속의 한국 전쟁",
            date: "24.11.11",
            score: 75,
            thumbnail: "/placeholder.svg?height=60&width=106",
            views: "30만",
          },
        ],
      },
    ],
  }

  const [sortState, setSortState] = useState<Record<string, { type: "date" | "score"; direction: "asc" | "desc" }>>({})

  const handleSort = (topicId: string, type: "date" | "score") => {
    setSortState((prev) => {
      const current = prev[topicId] || { type: "date", direction: "desc" }
      if (current.type === type) {
        // Toggle direction
        return { ...prev, [topicId]: { type, direction: current.direction === "desc" ? "asc" : "desc" } }
      }
      // New sort type defaults to desc (Newest first or Highest score first)
      return { ...prev, [topicId]: { type, direction: "desc" } }
    })
  }

  const getSortedVideos = (topic: (typeof channelData.topics)[0]) => {
    const { type, direction } = sortState[topic.id] || { type: "date", direction: "desc" }
    return [...topic.videos].sort((a, b) => {
      let comparison = 0
      if (type === "date") {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
      } else {
        comparison = a.score - b.score
      }
      return direction === "desc" ? comparison : -comparison
    })
  }

  const getSortIcon = (topicId: string, type: "date" | "score") => {
    const current = sortState[topicId]
    if (current?.type !== type) return null
    return current.direction === "desc" ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <AppHeader />

      <div className="border-b border-slate-100 sticky top-20 z-40 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="flex items-center h-14 px-4 max-w-3xl mx-auto">
          <Link href="/ranking" className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="flex-1 text-center font-bold text-lg text-slate-800">채널 종합 리포트</h1>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `${channelData.name} 채널 리포트`,
                  text: `${channelData.name}의 신뢰도는 ${channelData.trustScore}점입니다!`,
                  url: window.location.href,
                })
              } else {
                navigator.clipboard.writeText(window.location.href)
                alert("링크가 복사되었습니다!")
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full transition-all active:scale-95 border border-blue-200"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs">공유</span>
          </button>
        </div>
      </div>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Channel Identity Card */}
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-2.5">
            <div className="flex items-center justify-between mb-2">
              <a
                href="https://www.youtube.com/@shukaworld" // Mock URL
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-2.5 group items-center"
              >
                <div className="relative">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-md group-hover:ring-2 group-hover:ring-indigo-500 transition-all">
                    <Image
                      src={channelData.profileImage || "/placeholder.svg"}
                      alt={channelData.name}
                      width={44}
                      height={44}
                      className="object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm border border-white group-hover:bg-red-700 transition-colors">
                    <Play className="w-1.5 h-1.5 fill-current" /> SUB
                  </div>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-1 group-hover:text-indigo-700 transition-colors">
                    {channelData.name}{" "}
                    <ExternalLink className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h2>
                  <div className="text-[11px] text-slate-500 mt-0.5">구독자 {channelData.subscribers}</div>
                  <div className="inline-flex items-center mt-0.5 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-medium text-slate-600">
                    총 분석 {channelData.totalAnalysis}건
                  </div>
                </div>
              </a>

              <div className="flex items-center">
                <div className="text-center mr-1.5">
                  <div className="text-2xl font-black text-green-600 tracking-tight">{channelData.trustScore}</div>
                  <div className="text-[9px] font-medium text-slate-500 mt-0.5">종합 신뢰도</div>
                </div>
                <div className="relative w-8 h-8 -mr-1">
                  <Image
                    src="/images/traffic-light-character.png" // Updated traffic light image to png version
                    alt="신뢰도 캐릭터"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-px bg-slate-100 rounded-lg overflow-hidden border border-slate-100">
              <div className="bg-white py-1 px-1 flex flex-col items-center justify-center">
                <span className="text-[9px] text-slate-400 mb-0.5">정확성</span>
                <span className="text-sm font-bold text-slate-800">{channelData.stats.accuracy}%</span>
              </div>
              <div className="bg-white py-1 px-1 flex flex-col items-center justify-center">
                <span className="text-[9px] text-slate-400 mb-0.5">어그로</span>
                <span className="text-sm font-bold text-red-500">{channelData.stats.aggro}</span>
              </div>
              <div className="bg-white py-1 px-1 flex flex-col items-center justify-center relative overflow-hidden">
                <span className="text-[9px] text-slate-400 mb-0.5 z-10 relative">신뢰도 트렌드</span>
                <div className="flex items-center gap-1 z-10 relative">
                  <TrendingUp className="w-2.5 h-2.5 text-green-500" />
                  <span className="text-xs font-bold text-green-600">상승</span>
                </div>
                {/* Background Chart */}
                <div className="absolute bottom-0 left-0 right-0 h-5 opacity-20">
                  <TrendChart data={channelData.stats.trendData} color="#16a34a" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Topic Spectrum Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-slate-800">주제별 신뢰도 분석</h3>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {channelData.topics.map((topic) => (
              <AccordionItem
                key={topic.id}
                value={topic.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm data-[state=open]:ring-1 data-[state=open]:ring-indigo-500 data-[state=open]:border-indigo-500 transition-all duration-200"
              >
                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-lg">{topic.name}</span>
                        <Link
                          href={`/ranking?topic=${topic.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:opacity-80 active:scale-95 transition-all"
                        >
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 h-5 font-medium bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100"
                          >
                            상위 {topic.rankPercent}%
                          </Badge>
                        </Link>
                      </div>
                      <span className="text-xs text-slate-500">분석 영상 {topic.count}개</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-1">
                        <Link
                          href={`/ranking?topic=${topic.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="group/rank hover:opacity-80 active:scale-95 transition-all"
                        >
                          <div className="text-sm font-bold text-slate-600 leading-none group-hover/rank:text-indigo-600 transition-colors">
                            {topic.rank}위{" "}
                            <span className="text-slate-400 font-normal text-xs group-hover/rank:text-indigo-400 transition-colors">
                              / {topic.totalChannels}
                            </span>
                          </div>
                        </Link>
                      </div>

                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border-4
                        ${
                          topic.score >= 90
                            ? "border-green-100 text-green-600 bg-green-50"
                            : topic.score >= 70
                              ? "border-yellow-100 text-yellow-600 bg-yellow-50"
                              : "border-red-100 text-red-600 bg-red-50"
                        }`}
                      >
                        {topic.score}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-0 pb-0 border-t border-slate-100">
                  {/* Sort Controls */}
                  <div className="flex items-center justify-between px-5 py-3 bg-slate-50/50 border-b border-slate-100">
                    <button
                      onClick={() => handleSort(topic.id, "date")}
                      className={cn(
                        "text-xs font-medium flex items-center gap-1 transition-colors",
                        (sortState[topic.id]?.type || "date") === "date"
                          ? "text-slate-900"
                          : "text-slate-400 hover:text-slate-600",
                      )}
                    >
                      최근 분석된 영상
                      {getSortIcon(topic.id, "date")}
                    </button>

                    <button
                      onClick={() => handleSort(topic.id, "score")}
                      className={cn(
                        "text-xs font-medium flex items-center gap-1 transition-colors",
                        sortState[topic.id]?.type === "score"
                          ? "text-indigo-600"
                          : "text-slate-400 hover:text-slate-600",
                      )}
                    >
                      신뢰도순 정렬
                      {getSortIcon(topic.id, "score")}
                    </button>
                  </div>

                  {/* Video List */}
                  <div className="divide-y divide-slate-100">
                    {getSortedVideos(topic).map((video) => (
                      <Link
                        href={`/result?url=example&id=${video.id}`}
                        key={video.id}
                        className="flex gap-3 p-4 hover:bg-slate-50 transition-colors group"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-[106px] h-[60px] rounded-md overflow-hidden flex-shrink-0 bg-slate-200 shadow-sm">
                          <Image
                            src={video.thumbnail || "/placeholder.svg"}
                            alt={video.title}
                            fill
                            className="object-cover"
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <h4 className="text-sm font-medium text-slate-900 leading-snug line-clamp-2 group-hover:text-indigo-700 transition-colors">
                            {video.title}
                          </h4>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[11px] text-slate-400">{video.date}</span>
                            <div className="flex items-center gap-1">
                              <CheckCircle2
                                className={`w-3 h-3 ${video.score >= 80 ? "text-green-500" : "text-yellow-500"}`}
                              />
                              <span
                                className={`text-xs font-bold ${video.score >= 80 ? "text-green-600" : "text-yellow-600"}`}
                              >
                                {video.score}점
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="p-3 text-center border-t border-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-slate-500 w-full h-8 hover:text-indigo-600"
                    >
                      영상 더보기
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
    </div>
  )
}
