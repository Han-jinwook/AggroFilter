"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Star, AlertCircle, MoreHorizontal } from "lucide-react"

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

const greenTopics = ["경제", "과학", "역사", "다큐", "교육", "자기계발", "테크"]
const redTopics = ["코인", "가짜뉴스", "음모론", "사이버렉카", "정치선동", "루머"]

export default function DesignV3Page() {
  const [activeTab, setActiveTab] = useState<"analysis" | "channels">("analysis")

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* Soft Glass Header */}
      <header className="sticky top-0 z-50 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl bg-white/70 px-6 py-3 shadow-sm backdrop-blur-xl border border-white/50">
          <div className="flex items-center gap-4">
            <Link href="/design-test" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-bold text-slate-800">
              My Dashboard <span className="text-slate-400 font-normal text-sm ml-2">V3 Soft Minimal</span>
            </h1>
          </div>
          <div className="h-9 w-9 rounded-full bg-slate-200 overflow-hidden shadow-inner">
            <div className="w-full h-full bg-gradient-to-tr from-indigo-400 to-purple-400"></div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Insight Cards */}
        <div className="grid gap-6 md:grid-cols-2 mb-12">
          {/* Green Insight */}
          <div className="relative overflow-hidden rounded-[2rem] bg-white p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] transition-transform hover:scale-[1.01]">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-400"></div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">Trustworthy</h3>
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50 text-emerald-500">
                <Star className="w-5 h-5" fill="currentColor" />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {greenTopics.map((topic) => (
                <span
                  key={topic}
                  className="px-4 py-2 rounded-xl bg-emerald-50/50 text-emerald-700 text-sm font-bold border border-emerald-100/50"
                >
                  #{topic}
                </span>
              ))}
            </div>
          </div>

          {/* Red Insight */}
          <div className="relative overflow-hidden rounded-[2rem] bg-white p-8 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] transition-transform hover:scale-[1.01]">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-rose-400 to-orange-400"></div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">Warning</h3>
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-50 text-rose-500">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {redTopics.map((topic) => (
                <span
                  key={topic}
                  className="px-4 py-2 rounded-xl bg-rose-50/50 text-rose-700 text-sm font-bold border border-rose-100/50"
                >
                  #{topic}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("analysis")}
              className={`text-2xl font-bold transition-colors ${activeTab === "analysis" ? "text-slate-900" : "text-slate-300 hover:text-slate-500"}`}
            >
              Analysis
            </button>
            <button
              onClick={() => setActiveTab("channels")}
              className={`text-2xl font-bold transition-colors ${activeTab === "channels" ? "text-slate-900" : "text-slate-300 hover:text-slate-500"}`}
            >
              Channels
            </button>
          </div>
          <button className="p-2 rounded-full hover:bg-white transition-colors">
            <MoreHorizontal className="text-slate-400" />
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {mockVideos.map((video) => (
            <Link href={`/result?id=${video.id}`} key={video.id} className="group relative block">
              <div className="relative overflow-hidden rounded-[2.5rem] bg-white p-1 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-2">
                <div className="absolute top-8 right-8 z-10">
                  <div
                    className={`flex items-center justify-center w-14 h-14 rounded-2xl text-xl font-black text-white shadow-lg ${video.score >= 80 ? "bg-emerald-400 shadow-emerald-200" : video.score >= 50 ? "bg-orange-400 shadow-orange-200" : "bg-rose-400 shadow-rose-200"}`}
                  >
                    {video.score}
                  </div>
                </div>

                <div className="pt-12 px-8 pb-8">
                  <span className="inline-block px-3 py-1 mb-4 rounded-full bg-slate-100 text-xs font-bold text-slate-500 tracking-wide uppercase">
                    {video.category}
                  </span>
                  <h3 className="text-xl font-bold text-slate-800 leading-relaxed mb-6 line-clamp-2">{video.title}</h3>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200"></div>
                      <span className="text-sm font-medium text-slate-500">{video.channel}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-400">{video.date}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
