'use client';

/**
 * Version: v1.2.0
 * Last Updated: 2026-05-17
 * Description: 3D 곰발바닥 테마 글로벌 통합 및 HubAvatar 분리형 아바타 컴포넌트 추가
 */
import React, { useState, useEffect } from 'react';
import { useHub } from '../HubProvider';

interface HubAvatarProps {
  avatarUrl?: string;
  nickname?: string;
  isLoggedIn?: boolean;
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * [Custom] 허브 공통 아바타 컴포넌트 (HubAvatar v1.2)
 * 사장님이 고르신 '발바닥 게스트' 테마와 입체 살구색 배경을 공통 렌더링하는 표준 아바타 부품입니다.
 */
export const HubAvatar: React.FC<HubAvatarProps> = ({
  avatarUrl,
  nickname,
  isLoggedIn = true,
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = size === 'lg' ? 'w-20 h-20 rounded-full' : 'w-10 h-10 rounded-2xl';
  const textClass = size === 'lg' ? 'text-3xl' : 'text-base';

  // 비로그인 상태 (게스트)
  if (!isLoggedIn) {
    return (
      <div className={`flex items-center justify-center overflow-hidden bg-orange-50 ${sizeClasses} ${className}`}>
        <img 
          src="/hub_assets/guest_paw.png" 
          alt="Guest" 
          className={`w-full h-full object-contain ${size === 'lg' ? 'rounded-full' : 'rounded-2xl'}`}
        />
      </div>
    );
  }

  const displayId = nickname || '회원';
  const firstChar = displayId.charAt(0).toUpperCase();

  return (
    <div 
      className={`flex items-center justify-center overflow-hidden bg-orange-50 ${sizeClasses} ${className}`}
      style={
        !avatarUrl
          ? { backgroundImage: 'url("/hub_assets/guest_paw_bg.png")', backgroundSize: 'cover' }
          : {}
      }
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={nickname} className="w-full h-full object-cover" />
      ) : (
        <span 
          className={`font-bold ${textClass}`}
          style={{
            color: '#7b726d', // 곰발바닥의 짙은 회색 테두리 색상
            textShadow: '-1px -1px 0px rgba(255, 255, 255, 0.8), 1px 1px 1px rgba(0, 0, 0, 0.25)', // 3D 점토 엠보싱 효과
          }}
        >
          {firstChar}
        </span>
      )}
    </div>
  );
};

interface HubProfileWidgetProps {
  onLoginClick?: () => void;
  onProfileClick?: () => void;
  className?: string;
  showNickname?: boolean;
  layout?: 'col' | 'row'; // 가로(row) / 세로(col) 배치 지원 (기본값: col)
  variant?: 'paw' | 'standard'; // 하위 호환성용
}

/**
 * [Custom] 허브 프로필 위젯 (Premium v1.3)
 * 헤더용 프로필 위젯이며 내부적으로 공통 HubAvatar를 재사용합니다.
 */
export const HubProfileWidget: React.FC<HubProfileWidgetProps> = ({
  onLoginClick,
  onProfileClick,
  className = '',
  showNickname = true,
  layout = 'col',
}) => {
  const { isLoggedIn, isLoading, user } = useHub();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isRow = layout === 'row';

  // 로딩 상태 및 마운트 완료 전 스켈레톤 (Hydration Mismatch 완전 예방)
  if (!mounted || isLoading) {
    return (
      <div className={`flex ${isRow ? 'items-center gap-2 px-1' : 'flex-col items-center gap-1.5'} animate-pulse ${className}`}>
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-100" />
        {showNickname && <div className={`${isRow ? 'w-12 h-3' : 'w-10 h-2'} bg-slate-100 rounded-full hidden sm:block`} />}
      </div>
    );
  }

  // 비로그인 상태 (게스트)
  if (!isLoggedIn) {
    return (
      <button
        onClick={onLoginClick}
        className={`flex ${isRow ? 'items-center gap-1 p-0.5 rounded-full hover:bg-slate-100/80' : 'flex-col items-center gap-1'} group transition-all cursor-pointer ${className}`}
      >
        <HubAvatar isLoggedIn={false} size="sm" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full group-hover:scale-105 transition-transform" />
        {showNickname && (
          <span className={`hidden sm:block ${isRow ? 'text-[13px] sm:text-[14px] font-bold text-slate-500 pr-1' : 'text-[10px] sm:text-xs font-bold text-slate-400'} group-hover:text-blue-600 transition-colors`}>
            게스트
          </span>
        )}
      </button>
    );
  }

  // 로그인 상태 (회원 프로필)
  const displayId = (user?.nickname && user?.nickname !== '회원' && user?.nickname !== '가족회원') 
    ? user.nickname 
    : (user?.email?.split('@')[0] || '회원');

  return (
    <button
      onClick={onProfileClick}
      className={`flex ${isRow ? 'items-center gap-1 p-0.5 rounded-full hover:bg-slate-100/80' : 'flex-col items-center gap-1'} group transition-all cursor-pointer ${className}`}
    >
      <HubAvatar 
        isLoggedIn={true} 
        avatarUrl={user?.avatar_url} 
        nickname={displayId} 
        size="sm"
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full group-hover:scale-105 transition-transform" 
      />
      {showNickname && (
        <span className={`hidden sm:block ${isRow ? 'text-[13px] sm:text-[14px] font-bold text-slate-800 pr-1' : 'text-[10px] sm:text-xs font-semibold text-gray-700'} group-hover:text-blue-600 transition-colors truncate max-w-[100px] sm:max-w-[130px]`}>
          {displayId}
        </span>
      )}
    </button>
  );
};
