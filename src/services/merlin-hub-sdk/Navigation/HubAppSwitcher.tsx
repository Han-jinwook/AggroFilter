'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface FamilyApp {
  id: string;
  name: string;
  url: string;
  icon: React.ReactNode;
  description: string;
  isJoined: boolean;
}

export interface HubAppSwitcherProps {
  apps: FamilyApp[];
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

export function HubAppSwitcher({ apps }: HubAppSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const joinedApps = apps.filter(app => app.isJoined);
  const unjoinedApps = apps.filter(app => !app.isJoined);

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* 스위처 토글 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center justify-center gap-2 p-2 sm:px-3 sm:py-2 rounded-xl hover:bg-slate-100 active:scale-[0.95] transition-all"
        title="멀린 패밀리 앱"
      >
        <div className="w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center">
          <GridIcon />
        </div>
        <span className="hidden sm:inline text-sm font-bold text-slate-700 group-hover:text-slate-900">
          패밀리앱
        </span>
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[320px] origin-top-right rounded-3xl bg-white shadow-2xl shadow-slate-200/50 ring-1 ring-black/5 focus:outline-none z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 flex flex-col gap-1 max-h-[80vh] overflow-y-auto custom-scrollbar">
            
            {/* 1. 가입완료 앱 리스트 */}
            {joinedApps.length > 0 && (
              <div className="mb-2">
                <div className="px-3 pb-2 text-xs font-black text-slate-400 tracking-wider">
                  내 패밀리 앱
                </div>
                <div className="flex flex-col gap-1">
                  {joinedApps.map(app => (
                    <a
                      key={app.id}
                      href={app.url}
                      className="group flex items-center gap-3 rounded-2xl p-3 hover:bg-slate-50 active:scale-[0.98] transition-all"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl shadow-sm border border-slate-200/50 group-hover:bg-white group-hover:shadow-md transition-all">
                        {app.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                          {app.name}
                        </span>
                        <span className="text-xs text-slate-500 line-clamp-1">
                          {app.description}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* 구분선 */}
            {joinedApps.length > 0 && unjoinedApps.length > 0 && (
              <div className="h-px w-full bg-slate-100 my-2" />
            )}

            {/* 2. 미가입 앱 리스트 */}
            {unjoinedApps.length > 0 && (
              <div>
                <div className="px-3 pb-2 pt-2 text-xs font-black text-slate-400 tracking-wider">
                  새로운 발견
                </div>
                <div className="flex flex-col gap-1">
                  {unjoinedApps.map(app => (
                    <a
                      key={app.id}
                      href={app.url}
                      className="group flex items-center gap-3 rounded-2xl p-3 hover:bg-slate-50 active:scale-[0.98] transition-all"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all shadow-sm border border-slate-200/50">
                        {app.icon}
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
                            {app.name}
                          </span>
                          <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[9px] font-black text-slate-500">
                            미가입
                          </span>
                        </div>
                        <span className="text-xs font-medium text-indigo-500/80 group-hover:text-indigo-600 transition-colors line-clamp-1 mt-0.5">
                          {app.description}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}
