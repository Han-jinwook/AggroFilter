'use client';

import React, { useEffect, useState } from 'react';
import { useHub } from '../HubProvider';
import { MerlinHubClient } from '../CoreLogic/client';
import { Bell, Check, ExternalLink, Trash2, MailOpen, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface NotificationItem {
  id: string;
  app_id: string;
  app_name?: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
  link?: string;
}

export function HubNotificationDropdown({ onClose }: { onClose: () => void }) {
  const { refreshUnreadCount } = useHub();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const client = React.useMemo(() => new MerlinHubClient(), []);

  const loadNotifications = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await client.getNotifications(1, 20);
      setNotifications(list || []);
    } catch (err) {
      console.error('[HubNotificationDropdown] Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleRead = async (id: string, link?: string) => {
    try {
      await client.readNotifications([id]);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      refreshUnreadCount();
      if (link) {
        window.open(link, '_blank');
      }
    } catch (err) {
      console.error('[HubNotificationDropdown] Failed to mark as read:', err);
    }
  };

  const handleReadAll = async () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    try {
      await client.readNotifications(unreadIds);
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      refreshUnreadCount();
    } catch (err) {
      console.error('[HubNotificationDropdown] Failed to mark all as read:', err);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[500px] flex flex-col rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden z-50 text-white"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold tracking-wider uppercase text-slate-200">알림 센터</span>
        </div>
        {notifications.some(n => !n.is_read) && (
          <button
            onClick={handleReadAll}
            className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> 모두 읽음 처리
          </button>
        )}
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[380px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] font-medium">알림을 불러오는 중...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
            <Bell className="w-8 h-8 opacity-30" />
            <span className="text-xs font-bold">도착한 알림이 없습니다.</span>
          </div>
        ) : (
          notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => handleRead(notif.id, notif.link)}
              className={`p-4 hover:bg-white/5 transition-colors cursor-pointer relative group ${
                !notif.is_read ? 'bg-indigo-500/5' : ''
              }`}
            >
              {/* Unread dot indicator */}
              {!notif.is_read && (
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
              )}

              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  {notif.app_name || notif.app_id}
                </span>
                <span className="text-[9px] text-slate-400 font-bold">
                  {formatTime(notif.created_at)}
                </span>
              </div>

              <h4 className={`text-xs font-bold leading-snug mb-1 ${
                !notif.is_read ? 'text-white' : 'text-slate-300'
              }`}>
                {notif.title}
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                {notif.content.replace(/<[^>]*>/g, '')}
              </p>

              {notif.link && (
                <div className="mt-2 flex items-center gap-1 text-[9px] font-bold text-indigo-400 group-hover:underline">
                  <span>자세히 보기</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3.5 bg-white/5 border-t border-white/10 text-center">
        <button
          onClick={onClose}
          className="text-[10px] font-bold text-slate-400 hover:text-white transition-colors"
        >
          닫기
        </button>
      </div>
    </motion.div>
  );
}
