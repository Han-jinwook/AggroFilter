import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

/**
 * 🌐 Merlin Hub SDK Smart Offline & Reconnect Detector Banner
 * 오프라인/온라인 전환을 감지하여 자연스러운 상태 토스트를 제공합니다.
 */
export const HubOfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      {!isOnline ? (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/90 text-amber-300 text-xs sm:text-sm font-bold shadow-2xl backdrop-blur-md border border-amber-500/30">
          <WifiOff size={16} className="animate-pulse text-amber-400" />
          <span>네트워크 연결이 일시적으로 끊겼습니다 (오프라인)</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/90 text-emerald-300 text-xs sm:text-sm font-bold shadow-2xl backdrop-blur-md border border-emerald-500/30">
          <Wifi size={16} className="text-emerald-400" />
          <span>네트워크가 다시 연결되었습니다</span>
        </div>
      )}
    </aside>
  );
};
