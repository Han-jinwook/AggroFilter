'use client'

export default function MyPageError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">나의 페이지를 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-slate-500">데이터 형식 오류 또는 일시적 네트워크 문제일 수 있습니다.</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={reset}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            다시 시도
          </button>
          <button
            onClick={() => window.location.assign('/')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  )
}
