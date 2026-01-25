"use client"

import { useEffect, useState } from 'react'
import AppHeader from '@/components/c-app-header'
import { Settings, X } from 'lucide-react'

type TNotificationSettings = {
  gradeChange: boolean
  rankingChange: boolean
  top10Change: boolean
}

const DEFAULT_SETTINGS: TNotificationSettings = {
  gradeChange: true,
  rankingChange: true,
  top10Change: true,
}

const SETTINGS_KEY = 'notification_settings_v1'

export default function Page() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<TNotificationSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      setSettings({
        gradeChange: Boolean(parsed?.gradeChange),
        rankingChange: Boolean(parsed?.rankingChange),
        top10Change: Boolean(parsed?.top10Change),
      })
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      // ignore
    }
  }, [settings])

  const ToggleRow = ({
    label,
    description,
    checked,
    onChange,
  }: {
    label: string
    description: string
    checked: boolean
    onChange: (next: boolean) => void
  }) => {
    return (
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900">{label}</div>
          <div className="text-xs text-slate-500 mt-0.5">{description}</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
            checked ? 'bg-indigo-600' : 'bg-slate-200'
          }`}
          aria-pressed={checked}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-6 max-w-[var(--app-max-width)]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">알림</h1>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="h-10 w-10 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 active:scale-95 transition-all"
            aria-label="알림 설정"
          >
            <Settings className="h-5 w-5 text-slate-700" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          알림 목록은 아직 준비중입니다.
        </div>
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsSettingsOpen(false)}
            aria-label="닫기"
          />
          <div className="absolute top-24 left-1/2 -translate-x-1/2 w-[92vw] max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="text-base font-black text-slate-900">알림 설정</div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="h-9 w-9 rounded-full hover:bg-slate-100 flex items-center justify-center active:scale-95 transition-all"
                aria-label="닫기"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <div className="px-5 py-2 divide-y divide-slate-100">
              <ToggleRow
                label="등급 변화"
                description="구독한 채널의 신뢰도 등급(레드/옐로우/그린)이 바뀌면 알려줍니다"
                checked={settings.gradeChange}
                onChange={(next) => setSettings((prev) => ({ ...prev, gradeChange: next }))}
              />
              <ToggleRow
                label="랭킹 변화"
                description="구독한 채널의 카테고리 랭킹이 10% 이상 변동되면 알려줍니다"
                checked={settings.rankingChange}
                onChange={(next) => setSettings((prev) => ({ ...prev, rankingChange: next }))}
              />
              <ToggleRow
                label="상위 10% 진입/탈락"
                description="구독한 채널이 상위 10%에 들어오거나 벗어나면 알려줍니다"
                checked={settings.top10Change}
                onChange={(next) => setSettings((prev) => ({ ...prev, top10Change: next }))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
