import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * 🌐 Merlin Hub SDK Smart Offline & Reconnect Detector Banner
 * 오프라인/온라인 전환을 감지하여 5초 자동 사라짐 및 복구 상태 토스트를 제공합니다.
 */
export const HubOfflineBanner: React.FC = () => {
  const [showOffline, setShowOffline] = useState<boolean>(false);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);
  const offlineTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectedTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOffline = () => {
      setShowReconnected(false);
      setShowOffline(true);

      // 일시적 오작동으로 배너가 영구 고정되는 현상을 방지하기 위해 5초 후 자동 숨김
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = setTimeout(() => {
        setShowOffline(false);
      }, 5000);
    };

    const handleOnline = () => {
      setShowOffline(false);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);

      setShowReconnected(true);
      if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
      reconnectedTimerRef.current = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      if (reconnectedTimerRef.current) clearTimeout(reconnectedTimerRef.current);
    };
  }, []);

  if (!showOffline && !showReconnected) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      {showOffline ? (
        <div
          onClick={() => setShowOffline(false)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/95 text-amber-300 text-xs sm:text-sm font-bold shadow-2xl backdrop-blur-md border border-amber-500/30 cursor-pointer pointer-events-auto hover:bg-slate-800 transition-colors"
        >
          <WifiOff size={16} className="animate-pulse text-amber-400" />
          <span>네트워크 연결이 일시적으로 끊겼습니다 (오프라인)</span>
        </div>
      ) : (
        <div
          onClick={() => setShowReconnected(false)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/95 text-emerald-300 text-xs sm:text-sm font-bold shadow-2xl backdrop-blur-md border border-emerald-500/30 cursor-pointer pointer-events-auto hover:bg-slate-800 transition-colors"
        >
          <Wifi size={16} className="text-emerald-400" />
          <span>네트워크가 다시 연결되었습니다</span>
        </div>
      )}
    </aside>
  );
};

