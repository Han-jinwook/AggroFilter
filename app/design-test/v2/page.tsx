"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowUpRight } from "lucide-react"

const mockVideos = [
  {
    id: "1",
    date: "2025.01.15",
    title: "데이타솔루션, 딥시크 쇼크 대응 산업별 AI기술 융합해 경쟁력 강화",
    channel: "서울경제TV",
    score: 75,
    views: "1.2M",
    category: "ECONOMY",
    trend: "up",
  },
  {
    id: "2",
    date: "2025.02.07",
    title: "곧 컴백한다는 지드래곤의 솔로곡",
    channel: "아이돌아카이브",
    score: 92,
    views: "850K",
    category: "ENT",
    trend: "stable",
  },
  {
    id: "3",
    date: "2025.02.06",
    title: "비트코인은 몇 송 모두에게 자비가 없다",
    channel: "비트코인 차트두우",
    score: 55,
    views: "420K",
    category: "CRYPTO",
    trend: "down",
  },
  {
    id: "4",
    date: "2025.01.25",
    title: "혹백요리사 에기잘 갈데 꺼더리면 안 된다",
    channel: "백종원 PAIK JONG WON",
    score: 48,
    views: "2.1M",
    category: "FOOD",
    trend: "down",
  },
]

export default function DesignV2Page() {
  const [activeFilter, setActiveFilter] = useState("ALL")

  return (
    <div className="min-h-screen bg-white text-black font-mono selection:bg-blue-100">
      {/* Pro Header */}
      <header className="border-b-2 border-black bg-white sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/design-test"
              className="p-2 hover:bg-gray-100 border border-transparent hover:border-black transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-black tracking-tighter">AGGRO_FILTER</h1>
              <span className="text-xs font-bold bg-black text-white px-1">PRO</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center text-xs font-bold gap-4 border-r-2 border-black pr-4 mr-2">
              <span>KOSPI 2,540.23 ▲</span>
              <span>USD/KRW 1,320.50 ▼</span>
            </div>
            <div className="h-8 w-8 bg-black text-white flex items-center justify-center font-bold rounded-sm">MY</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
          {/* Left Column: User Stats */}
          <div className="md:col-span-4 border-2 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
            <h2 className="text-sm font-bold text-gray-500 mb-6 uppercase tracking-widest">User Status</h2>
            <div className="space-y-6">
              <div>
                <div className="text-4xl font-black mb-1">142</div>
                <div className="text-xs font-bold flex items-center gap-1">
                  TOTAL ANALYSIS <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
              <div className="h-px bg-gray-200 w-full"></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold mb-1">85.4</div>
                  <div className="text-[10px] font-bold text-gray-500">AVG TRUST SCORE</div>
                </div>
                <div>
                  <div className="text-2xl font-bold mb-1 text-red-600">12</div>
                  <div className="text-[10px] font-bold text-gray-500">RISK DETECTED</div>
                </div>
              </div>
            </div>
            <button className="w-full mt-8 bg-blue-600 text-white py-3 font-bold text-sm hover:bg-blue-700 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all border-2 border-transparent hover:border-black">
              NEW REPORT +
            </button>
          </div>

          {/* Right Column: Analysis Feed */}
          <div className="md:col-span-8">
            <div className="flex items-center justify-between mb-4 border-b-2 border-black pb-2">
              <h2 className="text-lg font-black uppercase">Analysis Feed</h2>
              <div className="flex gap-2">
                {["ALL", "HIGH_TRUST", "RISK"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1 text-xs font-bold border border-black ${activeFilter === filter ? "bg-black text-white" : "bg-white hover:bg-gray-100"}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {mockVideos.map((video) => (
                <Link href={`/result?id=${video.id}`} key={video.id} className="block group">
                  <div className="border border-gray-200 hover:border-black p-4 flex items-start gap-4 transition-all bg-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    {/* Score Box */}
                    <div
                      className={`flex flex-col items-center justify-center w-16 h-16 border-2 border-black ${
                        video.score >= 80 ? "bg-green-400" : video.score >= 50 ? "bg-yellow-300" : "bg-red-400"
                      }`}
                    >
                      <span className="text-xl font-black">{video.score}</span>
                      <span className="text-[9px] font-bold">SCORE</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-black text-white text-[10px] px-1 font-bold">{video.category}</span>
                        <span className="text-xs font-bold text-gray-500">{video.date}</span>
                      </div>
                      <h3 className="text-lg font-bold truncate group-hover:text-blue-700 mb-1">{video.title}</h3>
                      <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
                        <span className="flex items-center gap-1">
                          CH: <span className="font-bold text-black">{video.channel}</span>
                        </span>
                        <span>VIEWS: {video.views}</span>
                      </div>
                    </div>

                    {/* Status Icon */}
                    <div className="hidden sm:flex items-center h-full text-gray-300">
                      <ArrowUpRight className="w-6 h-6 group-hover:text-black" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
