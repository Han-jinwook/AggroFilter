"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AppHeader } from "@/components/c-app-header"
import { LoginModal } from "@/components/c-login-modal"
import { getUserId, isAnonymousUser } from "@/lib/anon"

// 클라이언트 전용 videoId 추출 (서버 전용 youtube-transcript-plus 임포트 회피)
function extractVideoId(url: string): string | null {
  if (!url) return null
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m && m[1]) return m[1].trim()
  }
  return null
}

// 확장팩에서 자막 데이터 수신 (최대 8초 대기)
function fetchTranscriptFromExtension(): Promise<{ transcript?: string; transcriptItems?: any[] } | null> {
  return new Promise((resolve) => {
    let resolved = false
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'AGGRO_TRANSCRIPT_DATA' && !resolved) {
        resolved = true
        window.removeEventListener('message', handler)
        window.postMessage({ type: 'AGGRO_TRANSCRIPT_RECEIVED' }, '*')
        const data = event.data.data
        if (data?.transcript) {
          console.log(`[확장팩] 자막 데이터 수신: ${data.transcript.length}자`)
          resolve(data)
        } else {
          resolve(null)
        }
      }
    }
    window.addEventListener('message', handler)
    setTimeout(() => {
      if (!resolved) {
        resolved = true
        window.removeEventListener('message', handler)
        resolve(null)
      }
    }, 8000)
  })
}

export default function PendingResultPage() {
  const router = useRouter()
  const [url, setUrl] = useState<string>("")
  const [from, setFrom] = useState<string>("")
  const [videoId, setVideoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const startedRef = useRef(false)

  // 초기 파라미터 읽기 (URL 파라미터 제거 전에)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const urlParam = params.get('url') || ""
    const fromParam = params.get('from') || ""
    setUrl(urlParam)
    setFrom(fromParam)
    setVideoId(urlParam ? extractVideoId(urlParam) : null)
  }, [])

  // 분석 시작 (url 세팅된 후 한 번만)
  useEffect(() => {
    if (!url || startedRef.current) return
    startedRef.current = true

    const run = async () => {
      try {
        // 1) 확장팩 자막 수집 (확장팩 경로일 때만)
        let clientTranscript: string | undefined
        let clientTranscriptItems: any[] | undefined
        if (from === 'chrome-extension') {
          const ext = await fetchTranscriptFromExtension()
          if (ext?.transcript) {
            clientTranscript = ext.transcript
            clientTranscriptItems = ext.transcriptItems
          }
        }

        // 2) 사용자 식별 / 1회 체험 제한
        const currentEmail = localStorage.getItem('userEmail')
        let analysisUserId: string
        if (currentEmail) {
          analysisUserId = getUserId()
        } else {
          const trialCount = parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10)
          if (trialCount >= 1) {
            setShowLoginModal(true)
            setError('로그인이 필요합니다.')
            return
          }
          analysisUserId = 'trial_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8)
        }

        const body: any = { url, userId: analysisUserId }
        if (clientTranscript) {
          body.clientTranscript = clientTranscript
          body.clientTranscriptItems = clientTranscriptItems
        }

        // 3) 빠른 폴링 + 분석 요청 레이스
        const pollForReadyResult = async (targetUrl: string, maxAttempts = 20, intervalMs = 1500) => {
          const pollUrl = `/api/analysis/status?url=${encodeURIComponent(targetUrl)}`
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, intervalMs))
            try {
              const statusRes = await fetch(pollUrl, { cache: 'no-store' })
              if (!statusRes.ok) continue
              const statusData = await statusRes.json()
              if (
                (statusData.status === 'pending' || statusData.status === 'speed_ready' || statusData.status === 'completed') &&
                statusData.analysisId
              ) {
                return { analysisId: statusData.analysisId }
              }
            } catch {}
          }
          return null
        }

        const fetchAnalysis = async () => {
          const response = await fetch('/api/analysis/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!response.ok) {
            let data: any = null
            try { data = await response.json() } catch {}
            const err: any = new Error(data?.error || '분석 요청에 실패했습니다.')
            err.statusCode = response.status
            err.data = data
            throw err
          }
          return response.json()
        }

        let result: any
        try {
          const requestPromise = fetchAnalysis()
          const raced = await Promise.race([
            requestPromise.then((data) => ({ source: 'request' as const, data })),
            pollForReadyResult(url).then((data) => (data ? { source: 'poll' as const, data } : null)),
          ])

          if (raced && raced.source === 'poll') {
            result = raced.data
            void requestPromise.catch(() => {})
          } else if (raced && raced.source === 'request') {
            result = raced.data
          } else {
            result = await requestPromise
          }
        } catch (firstError: any) {
          const statusCode = Number(firstError?.statusCode)
          const errorData = firstError?.data

          if (statusCode === 402 && errorData?.insufficientCredits === true) {
            alert('크레딧이 부족합니다. 충전 페이지로 이동합니다.')
            const returnUrl = encodeURIComponent('/')
            router.replace(`/payment/mock?redirectUrl=${returnUrl}`)
            return
          }

          if (statusCode === 422 && errorData?.cached === true) {
            const msg = firstError?.message
            if (msg) alert(String(msg))
            router.replace('/')
            return
          }

          throw firstError
        }

        window.dispatchEvent(new CustomEvent('creditsUpdated'))

        if (isAnonymousUser()) {
          const count = parseInt(localStorage.getItem('anonAnalysisCount') || '0', 10) + 1
          localStorage.setItem('anonAnalysisCount', String(count))
        }

        if (result?.analysisId) {
          router.replace(`/p-result?id=${result.analysisId}`)
        } else {
          setError('분석 결과를 받지 못했습니다.')
        }
      } catch (e: any) {
        console.error('분석 최종 실패:', e)
        setError(e?.message || '분석 중 오류가 발생했습니다.')
      }
    }

    run()
  }, [url, from, router])

  const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader onLoginClick={() => setShowLoginModal(true)} />

      <main className="flex-1 py-6">
        <div className="mx-auto max-w-[var(--app-max-width)] space-y-4 px-4">
          {/* 영상 카드 스켈레톤 (썸네일 즉시 노출) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative aspect-video w-full bg-slate-100">
              {thumb ? (
                <img
                  src={thumb}
                  alt="영상 썸네일"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                  영상 정보를 불러오는 중...
                </div>
              )}
            </div>
          </div>

          {/* 동적 진행 안내 */}
          {!error && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900">
              <p className="text-sm font-semibold flex items-center justify-center gap-0.5">
                <span>영상 타임라인 요약과 스포일러 분석 중</span>
                <span className="inline-flex ml-0.5">
                  <span className="inline-block animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                  <span className="inline-block animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                  <span className="inline-block animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                </span>
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
              <p className="text-sm font-semibold">{error}</p>
            </div>
          )}
        </div>
      </main>

      <LoginModal open={showLoginModal} onOpenChange={setShowLoginModal} onLoginSuccess={() => {}} />
    </div>
  )
}
