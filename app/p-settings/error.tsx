'use client'

export default function SettingsError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-bold">프로필 화면을 불러오지 못했습니다</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          일시적인 오류일 수 있습니다. 다시 시도해 주세요.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            다시 시도
          </button>
          <button
            onClick={() => window.location.assign('/')}
            className="rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  )
}
