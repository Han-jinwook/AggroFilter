"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// [대기제로 3단계] /p-result/pending 은 통합 라우트(/p-result)로 흡수됨.
// 이전 버전 확장팩/북마크 호환을 위해 query를 보존한 채 즉시 리다이렉트한다.
export default function PendingResultRedirect() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const url = params.get('url') || ''
    const from = params.get('from') || ''
    const next = `/p-result?url=${encodeURIComponent(url)}${from ? `&from=${encodeURIComponent(from)}` : ''}`
    router.replace(next)
  }, [router])

  return null
}
