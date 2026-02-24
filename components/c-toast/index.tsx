"use client"

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration?: number
}

type ToastListener = (toast: ToastItem) => void
const listeners: ToastListener[] = []

export function toast(message: string, type: ToastType = 'info', duration = 3000) {
  const item: ToastItem = { id: `${Date.now()}-${Math.random()}`, message, type, duration }
  listeners.forEach(fn => fn(item))
}
toast.success = (msg: string, duration?: number) => toast(msg, 'success', duration)
toast.error = (msg: string, duration?: number) => toast(msg, 'error', duration)
toast.warning = (msg: string, duration?: number) => toast(msg, 'warning', duration)
toast.info = (msg: string, duration?: number) => toast(msg, 'info', duration)

const ICONS = {
  success: <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
  error:   <XCircle    className="w-4 h-4 text-rose-500    flex-shrink-0" />,
  warning: <AlertCircle className="w-4 h-4 text-amber-500  flex-shrink-0" />,
  info:    <Info       className="w-4 h-4 text-indigo-500  flex-shrink-0" />,
}
const BG = {
  success: 'border-emerald-200 bg-emerald-50',
  error:   'border-rose-200    bg-rose-50',
  warning: 'border-amber-200   bg-amber-50',
  info:    'border-indigo-200  bg-indigo-50',
}
const TEXT = {
  success: 'text-emerald-800',
  error:   'text-rose-800',
  warning: 'text-amber-800',
  info:    'text-indigo-800',
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => {
    const handler = (item: ToastItem) => {
      setToasts(prev => [...prev, item])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== item.id))
      }, item.duration ?? 3000)
    }
    listeners.push(handler)
    return () => { const i = listeners.indexOf(handler); if (i > -1) listeners.splice(i, 1) }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium max-w-sm animate-in slide-in-from-bottom-2 fade-in duration-200 ${BG[t.type]} ${TEXT[t.type]}`}
        >
          {ICONS[t.type]}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
            className="opacity-50 hover:opacity-100 transition-opacity ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
