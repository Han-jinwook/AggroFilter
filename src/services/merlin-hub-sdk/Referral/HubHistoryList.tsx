/**
 * Version: v1.3.1
 * Last Updated: 2026-08-31
 */
import React, { useState, useMemo } from 'react';
import sundreamerLogo from '../assets/logos/sundreamer.png';
import whateatLogo from '../assets/logos/whateat.png';
import aggrofilterLogo from '../assets/logos/aggrofilter.png';

export interface HistoryItem {
  id: string;
  inviteeNickname: string;
  inviteeEmail?: string;
  joinedAt: string;
  firstAppId?: string;
  registeredApps?: string[];
  appJoinDates?: Record<string, string>;
}

export interface HubHistoryListProps {
  className?: string;
  history?: HistoryItem[];
  isLoading?: boolean;
}

const APP_LOGOS: Record<string, string> = {
  sundreamer: sundreamerLogo,
  whateat: whateatLogo,
  aggrofilter: aggrofilterLogo
};

const APP_LABELS: { label: string; value: string }[] = [
  { label: '전체 앱 (All)', value: 'all' },
  { label: '썬드리머', value: 'sundreamer' },
  { label: '뭐먹지?', value: 'whateat' },
  { label: '어그로필터', value: 'aggrofilter' },
];

const getAppBadge = (appId: string) => {
  const lower = (appId || '').toLowerCase();
  if (lower.includes('sundream')) {
    return { 
      name: '썬드리머', 
      logo: APP_LOGOS.sundreamer,
      bg: 'bg-amber-50 text-amber-900 border-amber-300' 
    };
  }
  if (lower.includes('whateat') || lower.includes('what_eat')) {
    return { 
      name: '뭐먹지', 
      logo: APP_LOGOS.whateat,
      bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' 
    };
  }
  if (lower.includes('aggro')) {
    return { 
      name: '어그로필터', 
      logo: APP_LOGOS.aggrofilter,
      bg: 'bg-rose-50 text-rose-900 border-rose-300' 
    };
  }
  return { 
    name: appId, 
    logo: null,
    bg: 'bg-slate-50 text-slate-800 border-slate-200' 
  };
};

/**
 * [Referral] 초대 실적 리스트
 * 내가 초대한 친구들의 전체 목록을 보여주고, 앱별 드롭다운 필터링을 지원합니다.
 */
export const HubHistoryList: React.FC<HubHistoryListProps> = ({ 
  className = '', 
  history = [], 
  isLoading = false
}) => {
  const [selectedApp, setSelectedApp] = useState<string>('all');

  const filteredHistory = useMemo(() => {
    if (selectedApp === 'all') return history;
    const target = selectedApp.toLowerCase();
    return history.filter(item => {
      const firstApp = (item.firstAppId || '').toLowerCase();
      if (firstApp.includes(target) || target.includes(firstApp)) return true;
      if (Array.isArray(item.registeredApps)) {
        return item.registeredApps.some(a => (a || '').toLowerCase().includes(target) || target.includes((a || '').toLowerCase()));
      }
      if (item.appJoinDates && typeof item.appJoinDates === 'object') {
        return Object.keys(item.appJoinDates).some(k => (k || '').toLowerCase().includes(target) || target.includes((k || '').toLowerCase()));
      }
      return false;
    });
  }, [history, selectedApp]);

  if (isLoading) {
    return <div className="w-full h-40 bg-gray-50 animate-pulse rounded-2xl" />;
  }

  return (
    <div className={`w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 ${className}`}>
      {/* 상단 헤더: 타이틀 + 카운트 + 앱별 드롭다운 필터 */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base sm:text-lg font-bold text-gray-900">앱 초대 List</h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-700">
            {filteredHistory.length}명
          </span>
        </div>

        {/* 앱 필터 드롭다운 */}
        <div className="relative">
          <select
            value={selectedApp}
            onChange={(e) => setSelectedApp(e.target.value)}
            className="h-9 px-3 pr-8 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-800 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-all"
          >
            {APP_LABELS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {filteredHistory.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl">
          {selectedApp === 'all' 
            ? '아직 초대한 친구가 없습니다.' 
            : `${APP_LABELS.find(a => a.value === selectedApp)?.label || selectedApp}에 가입한 초대 친구가 없습니다.`}
          <br/>
          친구를 초대하고 함께 혜택을 받아보세요!
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredHistory.map(item => {
            const apps = Array.from(new Set([
              ...(item.firstAppId ? [item.firstAppId] : []),
              ...(item.registeredApps || []),
              ...(item.appJoinDates ? Object.keys(item.appJoinDates) : [])
            ]));

            return (
              <li key={item.id} className="p-3.5 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors flex flex-col justify-center gap-1.5 border border-gray-100/60">
                {/* 1st Row: User Name & Full Email (Clean, without '님') */}
                <div className="flex items-center min-w-0">
                  <p className="font-bold text-gray-900 break-all leading-snug text-sm">
                    {item.inviteeNickname}
                    {item.inviteeEmail && (
                      <span className="text-xs font-normal text-gray-500 ml-1">({item.inviteeEmail})</span>
                    )}
                  </p>
                </div>

                {/* 2nd Row: Joined Date (Left) & App Badges (Right Aligned) */}
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-gray-400 font-medium shrink-0">
                    {item.joinedAt} 가입
                  </span>

                  {/* 가입된 앱 뱃지 목록 (날짜 우측 고정 정렬) */}
                  <div className="flex items-center gap-1 flex-wrap justify-end shrink-0">
                    {apps.length > 0 ? (
                      apps.map(a => {
                        const badge = getAppBadge(a);
                        return (
                          <span 
                            key={a} 
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs ${badge.bg}`}
                          >
                            {badge.logo ? (
                              <img 
                                src={badge.logo} 
                                alt={badge.name} 
                                className="w-3.5 h-3.5 object-contain rounded-full shrink-0" 
                              />
                            ) : (
                              <span className="text-[10px]">📱</span>
                            )}
                            <span>{badge.name}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-gray-400 font-medium">가입 앱 없음</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
