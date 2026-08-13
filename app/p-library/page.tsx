"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/c-app-header"
import { useHub } from "@/src/services/merlin-hub-sdk/react"
import { Loader2, Video, Calendar, CheckCircle2, Clock, AlertCircle } from "lucide-react"

interface QueueItem {
  f_id: string
  f_video_url: string
  f_video_id: string
  f_status: 'pending' | 'processing' | 'completed' | 'failed'
  f_created_at: string
}

export default function LibraryPage() {
  const router = useRouter()
  const { isLoggedIn, isLoading } = useHub()
  const [list, setList] = useState<QueueItem[]>([])
  const [fetching, setFetching] = useState(true)

  const fetchQueueList = async () => {
    try {
      const res = await fetch('/api/analysis/queue')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.list) {
          setList(data.list)
        }
      }
    } catch (err) {
      console.error('Failed to fetch queue list:', err)
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    if (isLoading) return
    if (!isLoggedIn) {
      // 로그인하지 않았을 때 홈으로 돌려보내거나 로그인 알림
      alert('보관함은 로그인 후 이용하실 수 있습니다.')
      router.push('/')
      return
    }
    fetchQueueList()

    // 15초마다 주기적 실시간 갱신 (폴링)
    const interval = setInterval(fetchQueueList, 15000)
    return () => clearInterval(interval)
  }, [isLoggedIn, isLoading, router])

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr)
    return `${d.getFullYear().toString().substring(2)}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />

      <main className="flex-1 pt-6 pb-12">
        <div className="mx-auto max-w-[var(--app-max-width)] px-4 space-y-6">
          <div className="flex items-center justify-between border-b-4 border-black pb-4">
            <h1 className="text-2xl font-black text-slate-900">📦 내 분석 예약 보관함</h1>
            <p className="text-xs font-bold text-slate-500">모바일에서 담은 영상의 PC 백그라운드 분석 대기 상태입니다.</p>
          </div>

          {fetching ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-2">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF9800]" />
              <p className="text-sm font-bold text-slate-500">보관함 목록 로딩 중...</p>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-center space-y-4">
              <div className="p-4 bg-slate-100 rounded-full border-3 border-black">
                <Video className="h-10 w-10 text-slate-400" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-black text-slate-900">보관함이 비어 있습니다.</p>
                <p className="text-xs font-bold text-slate-500">모바일 PWA나 메인 페이지에서 유튜브 링크를 보관함에 담아보세요.</p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="px-6 py-2.5 bg-[#FF9800] text-black font-black rounded-2xl border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                예약하러 가기
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
              {list.map((item) => {
                const isCompleted = item.f_status === 'completed'
                const isProcessing = item.f_status === 'processing'
                const isFailed = item.f_status === 'failed'

                return (
                  <div
                    key={item.f_id}
                    onClick={() => {
                      if (isCompleted) {
                        router.push(`/p-result?url=${encodeURIComponent(item.f_video_url)}`)
                      }
                    }}
                    className={`p-5 rounded-3xl border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between transition-all ${
                      isCompleted 
                        ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0' 
                        : 'opacity-85'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* 상태 뱃지 및 예약 일시 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {isCompleted && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-green-50 text-green-600 border-2 border-green-600">
                              <CheckCircle2 className="h-3 w-3" /> 분석 완료
                            </span>
                          )}
                          {isProcessing && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-600 border-2 border-blue-600 animate-pulse">
                              <Loader2 className="h-3 w-3 animate-spin" /> 분석 진행 중
                            </span>
                          )}
                          {item.f_status === 'pending' && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-50 text-amber-600 border-2 border-amber-600">
                              <Clock className="h-3 w-3" /> PC 대기 중
                            </span>
                          )}
                          {isFailed && (
                            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-red-50 text-red-600 border-2 border-red-600">
                              <AlertCircle className="h-3 w-3" /> 분석 실패
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatDate(item.f_created_at)}
                        </span>
                      </div>

                      {/* 유튜브 URL 정보 */}
                      <div className="space-y-1">
                        <p className="text-xs font-black text-slate-800 break-all line-clamp-2">
                          {item.f_video_url}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">
                          Video ID: {item.f_video_id}
                        </p>
                      </div>
                    </div>

                    {/* 완료 시 클릭 유도 풋터 */}
                    {isCompleted && (
                      <div className="mt-4 pt-3 border-t-2 border-slate-100 text-right">
                        <span className="text-xs font-extrabold text-blue-600">
                          👉 분석 결과 확인하기
                        </span>
                      </div>
                    )}
                    {item.f_status === 'pending' && (
                      <div className="mt-4 pt-3 border-t-2 border-slate-100 text-left">
                        <p className="text-[10px] font-bold text-slate-400 leading-normal">
                          * 집/사무실 PC의 크롬 브라우저를 켜면 분석이 백그라운드에서 자동으로 즉시 실행됩니다.
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
