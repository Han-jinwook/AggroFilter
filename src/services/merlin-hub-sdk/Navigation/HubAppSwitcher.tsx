'use client';

import React, { useState, useRef, useEffect } from 'react';
import { getConfig } from '../CoreLogic/config';
import { hubFetch } from '../CoreLogic/client';

import { useHub } from '../react';

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
  joinedAppIds?: string[]; // 유저가 찐사(가입)한 패밀리 앱 ID 목록 (명시적 전달용)
}


export function HubAppSwitcher({ currentAppId, joinedAppIds = [] }: HubAppSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<FamilyConfig | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { user } = useHub();

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

  // 현재 내 앱(currentAppId)이 대시보드에서 '활성(isActive)' 상태가 아니라면 스위처를 아예 감춤
  const currentAppConfig = config.apps.find(app => app.id === currentAppId);
  if (currentAppConfig && !currentAppConfig.isActive) {
    return null;
  }

  // 활성화된 앱만 정렬하여 필터링 (현재 접속중인 앱은 목록에서 아예 제외)
  const launchedApps = config.apps
    .filter(app => app.isActive && app.id !== currentAppId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 명시적으로 전달된 joinedAppIds가 없으면 현재 로그인된 유저의 정보 사용
  const effectiveJoinedIds = joinedAppIds.length > 0 ? joinedAppIds : (user?.registered_apps || []);
  const lowercaseJoinedIds = effectiveJoinedIds.map(id => id.toLowerCase());

  // 가입 상태 매핑
  const appsWithStatus = launchedApps.map(app => ({
    ...app,
    isJoined: lowercaseJoinedIds.includes(app.id.toLowerCase())
  }));

  const joinedApps = appsWithStatus.filter(app => app.isJoined);
  const unjoinedApps = appsWithStatus.filter(app => !app.isJoined);

  // 현재 접속중인 앱 하나만 있거나 가입/미가입 앱이 모두 없으면 스위처를 그리지 않음
  if (joinedApps.length === 0 && unjoinedApps.length === 0) {
    return null;
  }

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* 트리거 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-all duration-300 group hover:scale-105 active:scale-95"
        aria-label="패밀리 앱 열기"
      >
        <img 
          src={`${getConfig().hubUrl}/family-icon.png`} 
          alt="Family Apps" 
          className="w-7 h-7 object-contain opacity-80 group-hover:opacity-100 drop-shadow-sm transition-all"
        />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[#1e1e24] border border-white/10 rounded-3xl shadow-[0_16px_40px_rgba(0,0,0,0.2)] p-4 z-50 transform origin-top-right transition-all animate-in fade-in zoom-in duration-200">
          
          {/* My Apps (가입된 앱) */}
          {joinedApps.length > 0 && (
            <div className="mb-4">
              <h3 className="text-[11px] font-black text-slate-400/80 uppercase tracking-widest mb-3 px-2">My Apps</h3>
              <div className="grid grid-cols-3 gap-2">
                {joinedApps.map((app) => (
                  <a 
                    key={app.id}
                    href={app.url} 
                    className="flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 hover:bg-white/10 hover:shadow-sm cursor-pointer active:scale-95"
                  >
                    <div className="text-3xl mb-2 transition-transform duration-300 hover:scale-110">
                      {app.icon}
                    </div>
                    <span className="text-xs font-bold whitespace-nowrap text-slate-200">
                      {app.name}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Discovery (미가입 앱) */}
          {unjoinedApps.length > 0 && (
            <div className={`pt-4 ${joinedApps.length > 0 ? 'border-t border-white/10' : ''}`}>
              <h3 className="text-[11px] font-black text-slate-400/80 uppercase tracking-widest mb-3 px-2 flex items-center gap-2">
                Discovery <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] px-1.5 py-0.5 rounded-full">New</span>
              </h3>
              <div className="space-y-1">
                {unjoinedApps.map((app) => (
                  <a 
                    key={app.id}
                    href={app.url} 
                    className="flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all duration-300 cursor-pointer group active:scale-[0.98]"
                  >
                    <div className="text-3xl bg-white/10 w-12 h-12 rounded-xl shadow-sm border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      {app.icon}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-100 truncate">{app.name}</span>
                        {app.openSchedule && (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                            {app.openSchedule}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-medium text-slate-400 truncate mt-0.5">
                        {app.description}
                      </span>
                    </div>
                    <div className="text-xs font-black text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
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
