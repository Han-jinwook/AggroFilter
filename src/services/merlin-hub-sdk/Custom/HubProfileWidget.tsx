'use client';

/**
 * Version: v1.0.0
 * Last Updated: 2026-05-15
 */
import React from 'react';
import { useHubSession } from '../Core/useHubSession';

interface HubProfileWidgetProps {
  onLoginClick?: () => void;
  onProfileClick?: () => void;
  className?: string;
  showNickname?: boolean;
}

/**
 * [Custom] 허브 프로필 위젯
 * 사장님이 고르신 '발바닥 게스트' 아이콘을 기본으로 하는 표준 UI 컴포넌트입니다.
 */
export const HubProfileWidget: React.FC<HubProfileWidgetProps> = ({
  onLoginClick,
  onProfileClick,
  className = '',
  showNickname = true,
}) => {
  const { isLoggedIn, isLoading, user } = useHubSession();

  // 로딩 상태 (스켈레톤)
  if (isLoading) {
    return (
      <div className={`flex flex-col items-center gap-1 animate-pulse ${className}`}>
        <div className="w-10 h-10 rounded-2xl bg-gray-200" />
        <div className="w-12 h-3 bg-gray-100 rounded" />
      </div>
    );
  }

  // 비로그인 상태 (발바닥 게스트)
  if (!isLoggedIn) {
    return (
      <button
        onClick={onLoginClick}
        className={`flex flex-col items-center gap-1 group hover:opacity-80 transition-all ${className}`}
      >
        <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center overflow-hidden border border-orange-100 group-hover:scale-105 transition-transform">
          <img 
            src="/hub_assets/guest_paw.png" 
            alt="Guest" 
            className="w-full h-full object-contain rounded-2xl"
          />
        </div>
        {showNickname && (
          <span className="text-xs font-medium text-gray-500 group-hover:text-blue-600">게스트</span>
        )}
      </button>
    );
  }

  // 로그인 상태 (회원 프로필)
  return (
    <button
      onClick={onProfileClick}
      className={`flex flex-col items-center gap-1 group hover:opacity-80 transition-all ${className}`}
    >
      <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center overflow-hidden border border-blue-100 group-hover:scale-105 transition-transform">
        {user?.avatar_url ? (
          <img src={user.avatar_url} alt={user.nickname} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-bold text-sm">
            {user?.nickname?.charAt(0) || 'M'}
          </div>
        )}
      </div>
      {showNickname && (
        <span className="text-xs font-semibold text-gray-700 group-hover:text-blue-600">
          {user?.nickname || '회원'}
        </span>
      )}
    </button>
  );
};
