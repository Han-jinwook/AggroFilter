'use client';

/**
 * Version: v1.1.0
 * Last Updated: 2026-05-16
 * Description: 프리미엄 레이아웃 및 애니메이션이 적용된 표준 프로필 위젯 (Global Context 연동)
 */
import React from 'react';
import { useHub } from '../HubProvider';

interface HubProfileWidgetProps {
  onLoginClick?: () => void;
  onProfileClick?: () => void;
  className?: string;
  showNickname?: boolean;
}

/**
 * [Custom] 허브 프로필 위젯 (Premium v1.1)
 * 사장님이 고르신 '발바닥 게스트' 아이콘을 기본으로 하는 표준 UI 컴포넌트입니다.
 */
export const HubProfileWidget: React.FC<HubProfileWidgetProps> = ({
  onLoginClick,
  onProfileClick,
  className = '',
  showNickname = true,
}) => {
  const { isLoggedIn, isLoading, user } = useHub();

  // 로딩 상태 (스켈레톤)
  if (isLoading) {
    return (
      <div className={`flex flex-col items-center gap-1.5 animate-pulse ${className}`}>
        <div className="w-10 h-10 rounded-2xl bg-slate-100" />
        {showNickname && <div className="w-10 h-2 bg-slate-50 rounded-full" />}
      </div>
    );
  }

  // 공통 아이콘 스타일
  const iconWrapperClass = "w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden border-2 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg";

  // 비로그인 상태 (발바닥 게스트)
  if (!isLoggedIn) {
    return (
      <button
        onClick={onLoginClick}
        className={`flex flex-col items-center gap-1 group active:scale-95 transition-all ${className}`}
      >
        <div className={`${iconWrapperClass} bg-orange-50 border-orange-100 group-hover:border-orange-200 group-hover:shadow-orange-200/20`}>
          <img 
            src="/hub_assets/guest_paw.png" 
            alt="Guest" 
            className="w-full h-full object-contain"
          />
        </div>
        {showNickname && (
          <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-600 transition-colors">게스트</span>
        )}
      </button>
    );
  }

  // 로그인 상태 (회원 프로필)
  const firstChar = (user?.nickname || user?.email || 'M').charAt(0).toUpperCase();

  return (
    <button
      onClick={onProfileClick}
      className={`flex flex-col items-center gap-1 group active:scale-95 transition-all ${className}`}
    >
      <div className={`${iconWrapperClass} bg-blue-50 border-blue-100 group-hover:border-blue-200 group-hover:shadow-blue-200/20`}>
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt={user.nickname} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-black text-sm">
            {firstChar}
          </div>
        )}
      </div>
      {showNickname && (
        <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-600 transition-colors line-clamp-1 max-w-[60px]">
          {user?.nickname || '회원'}
        </span>
      )}
    </button>
  );
};

