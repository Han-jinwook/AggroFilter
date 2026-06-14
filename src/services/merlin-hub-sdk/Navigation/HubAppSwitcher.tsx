'use client';

import React, { useState, useRef, useEffect } from 'react';
import { getConfig } from '../CoreLogic/config';
import { hubFetch } from '../CoreLogic/client';

export interface FamilyApp {
  id: string;
  name: string;
  url: string;
  icon: React.ReactNode;
  description: string;
  isActive: boolean;
  openSchedule?: string;
  sortOrder: number;
  isJoined?: boolean;
}

export interface FamilyConfig {
  isFeatureLive: boolean;
  apps: FamilyApp[];
}

export interface HubAppSwitcherProps {
  currentAppId?: string; // 현재 실행중인 앱의 ID (예: 'aggrofilter')
  joinedAppIds?: string[]; // 유저가 찐사(가입)한 패밀리 앱 ID 목록
}

// 9점 그리드 아이콘 (구글 스타일 앱 런처 아이콘)
const GridIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-slate-600 group-hover:text-slate-900 transition-colors">
    <circle cx="4" cy="4" r="2" />
    <circle cx="12" cy="4" r="2" />
    <circle cx="20" cy="4" r="2" />
    <circle cx="4" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="20" cy="12" r="2" />
    <circle cx="4" cy="20" r="2" />
    <circle cx="12" cy="20" r="2" />
    <circle cx="20" cy="20" r="2" />
  </svg>
);

export function HubAppSwitcher({ currentAppId, joinedAppIds = [] }: HubAppSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<FamilyConfig | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 중앙 통제 설정 불러오기
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await hubFetch<{ isFeatureLive: boolean; apps: FamilyApp[] }>('/api/family/config');
        if (res.ok && res.data) {
          setConfig(res.data);
        }
      } catch (err) {
        console.error('[HubAppSwitcher] Failed to load config', err);
      }
    };
    loadConfig();
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 🚀 설정이 로드되지 않았거나, 중앙 스위치가 꺼져있으면 렌더링하지 않음
  if (!config || !config.isFeatureLive) {
    return null;
  }

  // 활성화된 앱만 정렬하여 필터링
  const launchedApps = config.apps
    .filter(app => app.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 가입 상태 매핑
  const appsWithStatus = launchedApps.map(app => ({
    ...app,
    isJoined: joinedAppIds.includes(app.id) || app.id === currentAppId
  }));

  const joinedApps = appsWithStatus.filter(app => app.isJoined);
  const unjoinedApps = appsWithStatus.filter(app => !app.isJoined);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* 트리거 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors group"
        aria-label="패밀리 앱 열기"
      >
        <GridIcon />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] p-4 z-50 transform origin-top-right transition-all animate-in fade-in zoom-in duration-200">
          
          {/* My Apps (가입된 앱) */}
          <div className="mb-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">My Apps</h3>
            <div className="grid grid-cols-3 gap-2">
              {joinedApps.map((app) => (
                <a 
                  key={app.id}
                  href={app.id === currentAppId ? '#' : app.url} 
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300
                    ${app.id === currentAppId 
                      ? 'bg-indigo-50/80 ring-1 ring-indigo-100/50 cursor-default shadow-sm' 
                      : 'hover:bg-slate-50 hover:shadow-sm cursor-pointer active:scale-95'
                    }`}
                >
                  <div className={`text-3xl mb-2 transition-transform duration-300 ${app.id !== currentAppId && 'hover:scale-110'}`}>
                    {app.icon}
                  </div>
                  <span className={`text-xs font-bold whitespace-nowrap
                    ${app.id === currentAppId ? 'text-indigo-700' : 'text-slate-700'}
                  `}>
                    {app.name}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Discovery (미가입 앱) */}
          {unjoinedApps.length > 0 && (
            <div className="pt-4 border-t border-slate-100/60">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2 flex items-center gap-2">
                Discovery <span className="bg-rose-100 text-rose-600 text-[9px] px-1.5 py-0.5 rounded-full">New</span>
              </h3>
              <div className="space-y-1">
                {unjoinedApps.map((app) => (
                  <a 
                    key={app.id}
                    href={app.url} 
                    className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-all duration-300 cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="text-3xl bg-white w-12 h-12 rounded-xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      {app.icon}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-800 truncate">{app.name}</span>
                        {app.openSchedule && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                            {app.openSchedule}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-slate-500 truncate mt-0.5">
                        {app.description}
                      </span>
                    </div>
                    <div className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      둘러보기
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
