/**
 * Version: v2.1.0
 * Last Updated: 2026-08-27
 * Merlin Hub SDK — 프로필/알림/로그아웃/탈퇴 카드
 */
'use client';

import React, { useState, useEffect } from 'react';
import { Camera, Mail, User, Edit2, Save, LogOut, Bell } from 'lucide-react';
import { MerlinHub } from '../index';
import { HubAvatar } from './HubProfileWidget';
import { useHub } from '../HubProvider';
import { compressImage, triggerHaptic } from '../CoreLogic/index';

// -----------------------------------------
// 1. HubProfileCard (상단 섹션: 프로필 뷰 및 수정)
// -----------------------------------------
export interface HubProfileCardProps {
  onSuccess?: (nickname: string, avatarUrl: string) => void;
  className?: string;
  showCoin?: boolean; // 코인이 없는 무료/회원용 앱(썬드리머 등)을 위한 분기 플래그 (기본값: true)
  nicknameLabel?: React.ReactNode; // 커스텀 닉네임 라벨 (예: 앱 닉네임 (카페 별명 권장))
}

export const HubProfileCard: React.FC<HubProfileCardProps> = ({ onSuccess, className = '', showCoin = true, nicknameLabel }) => {
  const { user, isLoggedIn, balance } = useHub();
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [email, setEmail] = useState('');
  const [tempNickname, setTempNickname] = useState('');
  const [tempProfileImage, setTempProfileImage] = useState('');

  useEffect(() => {
    // 로컬 스토리지에서 기본값 가져오기
    const storedEmail = localStorage.getItem('userEmail');
    const storedNickname = localStorage.getItem('userNickname');
    const storedProfileImage = localStorage.getItem('userProfileImage');

    const currentEmail = user?.email || storedEmail || '';
    const emailId = currentEmail ? currentEmail.split('@')[0] : '회원';
    
    // 로컬스토리지의 닉네임이 '회원' 또는 '가족회원'이면 이메일 ID로 즉시 보정하여 UI 깜빡임 방지
    const initNickname = (storedNickname && storedNickname !== '회원' && storedNickname !== '가족회원')
      ? storedNickname
      : (emailId !== '회원' ? emailId : '게스트');

    setNickname(initNickname);
    setProfileImage(storedProfileImage || '');
    setEmail(currentEmail);

    if (isLoggedIn) {
      // 서버에서 최신 프로필 정보 갱신
      MerlinHub.auth.getProfile()
        .then(result => {
          if (result.success) {
            const dbNickname = (result.nickname && result.nickname !== '회원' && result.nickname !== '가족회원') 
              ? result.nickname 
              : emailId;
            const dbImage = result.avatar_url || '';
            setNickname(dbNickname);
            setProfileImage(dbImage);
            localStorage.setItem('userNickname', dbNickname);
            localStorage.setItem('userProfileImage', dbImage);
          }
        })
        .catch(() => {});
    }
  }, [isLoggedIn, user]);

  const handleEdit = () => {
    setTempNickname(nickname);
    setTempProfileImage(profileImage);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (tempNickname.trim()) {
      if (isLoggedIn) {
        try {
          const result = await MerlinHub.auth.updateProfile({
            nickname: tempNickname,
            avatar_url: tempProfileImage || ''
          });

          if (result.success) {
            const savedNickname = result.nickname || tempNickname;
            const savedImage = result.avatar_url || '';
            setNickname(savedNickname);
            setProfileImage(savedImage);
            localStorage.setItem('userNickname', savedNickname);
            localStorage.setItem('userProfileImage', savedImage);
            window.dispatchEvent(new Event('profileUpdated'));
            setIsEditing(false);
            if (onSuccess) onSuccess(savedNickname, savedImage);
          } else {
            console.error('Failed to update profile:', result.error);
            alert(result.error || '프로필 수정에 실패했습니다.');
          }
        } catch (error) {
          console.error('Profile update error:', error);
        }
      } else {
        // 비회원 로컬 변경
        setNickname(tempNickname);
        setProfileImage(tempProfileImage || '');
        localStorage.setItem('userNickname', tempNickname);
        localStorage.setItem('userProfileImage', tempProfileImage || '');
        window.dispatchEvent(new Event('profileUpdated'));
        setIsEditing(false);
        if (onSuccess) onSuccess(tempNickname, tempProfileImage || '');
      }
    }
  };

  const handleCancel = () => {
    setTempNickname('');
    setTempProfileImage('');
    setIsEditing(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, {
          maxWidth: 300,
          maxHeight: 300,
          quality: 0.8,
          format: 'image/webp'
        });
        setTempProfileImage(compressed.dataUrl);
        triggerHaptic('light');
      } catch (err) {
        console.error('[HubProfileCard] Image compression failed:', err);
      }
    }
  };

  const getDisplayNickname = () => isEditing ? tempNickname : nickname;
  const getDisplayImage = () => isEditing ? tempProfileImage : profileImage;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 ${className}`}>
      
      {/* 🚀 상단 코인 배너 (모바일 등에서 헤더 코인 UI를 대체/보완) */}
      {isLoggedIn && showCoin && (
        <a 
          href="/payment/purchase"
          className="flex items-center justify-between p-3 mb-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-amber-100 hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-pointer no-underline"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-amber-100 group-hover:scale-110 transition-transform">
              <span className="text-amber-500 font-black text-lg">C</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-amber-600/80 mb-0.5">내 잔여 코인</span>
              <span className="text-lg font-black text-amber-600 leading-none tracking-tight">
                {balance !== null ? balance.toLocaleString() : '...'} 코인
              </span>
            </div>
          </div>
          <div className="text-amber-600 font-bold text-xs flex items-center gap-1 bg-white/60 px-2.5 py-1 rounded-full border border-amber-200/50 group-hover:bg-white transition-colors">
            충전·내역 <span className="text-sm leading-none mb-0.5">›</span>
          </div>
        </a>
      )}

      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">프로필 정보</h2>
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs sm:text-sm font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          >
            <Edit2 className="h-3.5 w-3.5" />
            수정하기
          </button>
        )}
      </div>

      <div className="space-y-3.5">
        {/* 프로필 이미지 및 닉네임 */}
        <div className="flex items-center gap-3.5 sm:gap-4">
          <div className="relative flex-shrink-0">
            <HubAvatar 
              isLoggedIn={isLoggedIn}
              avatarUrl={getDisplayImage()}
              nickname={getDisplayNickname()}
              size="lg"
              className="w-12 h-12 sm:w-14 sm:h-14 border border-slate-200 shadow-sm"
            />
            {isEditing && (
              <label className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors shadow-md border-2 border-white">
                <Camera className="h-3 w-3" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
          
          {/* 닉네임 */}
          <div className="flex-1 min-w-0">
            <label className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-500 mb-1.5">
              <User className="h-3.5 w-3.5 shrink-0" />
              {nicknameLabel || '닉네임'}
            </label>
            <input
              type="text"
              value={isEditing ? tempNickname : nickname}
              onChange={(e) => setTempNickname(e.target.value)}
              disabled={!isEditing}
              className={`w-full px-3.5 py-2 border rounded-xl text-xs sm:text-sm font-medium transition-colors h-[40px] ${
                isEditing
                  ? 'bg-white border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900'
                  : 'bg-slate-50 border-slate-200 text-slate-700 cursor-not-allowed'
              }`}
            />
          </div>
        </div>

        {/* 이메일 */}
        <div>
          <label className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-500 mb-1.5">
            <Mail className="h-3.5 w-3.5" />
            이메일
          </label>
          {!isLoggedIn ? (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('openLoginModal'))}
              className="w-full rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 hover:from-blue-100 hover:to-indigo-100 transition-colors cursor-pointer overflow-hidden group h-[40px]"
            >
              <div className="flex items-center gap-2.5 px-3.5 h-full">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                  <Mail className="h-3 w-3" />
                </div>
                <div className="text-left flex-1 flex items-center justify-between">
                  <p className="text-xs sm:text-sm font-bold text-blue-800">이메일 등록/로그인 👋</p>
                </div>
              </div>
            </button>
          ) : (
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 cursor-not-allowed text-xs sm:text-sm font-medium h-[40px]"
            />
          )}
        </div>

        {/* 편집 모드 버튼들 */}
        {isEditing && (
          <div className="flex gap-2.5 pt-3 border-t border-slate-100 mt-4">
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 text-xs sm:text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="flex-[2] flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              저장하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// -----------------------------------------
// 2. HubNotificationCard (중단 섹션: 스마트 알림 설정)
// -----------------------------------------
export interface HubNotificationCardProps {
  title?: string;
  toggleLabel?: string;
  description?: React.ReactNode;
  enabled?: boolean;
  onChange?: (enabled: boolean) => void;
  className?: string;
  children?: React.ReactNode;
}

export const HubNotificationCard: React.FC<HubNotificationCardProps> = ({
  title = '알림 설정',
  toggleLabel = '📧 이메일 알림 수신',
  description = '허브 서비스의 점검, 중요 공지 및 혜택 알림 이메일을 수신합니다.',
  enabled,
  onChange,
  className = '',
  children
}) => {
  const { isLoggedIn } = useHub();
  const [internalEnabled, setInternalEnabled] = useState(true);

  useEffect(() => {
    if (enabled === undefined) {
      const stored = localStorage.getItem('hubSmartNotification') || localStorage.getItem('hubMarketingConsent');
      if (stored === 'false') {
        setInternalEnabled(false);
      } else {
        setInternalEnabled(true);
      }
    }
  }, [enabled]);

  const isToggled = enabled !== undefined ? enabled : internalEnabled;

  const handleToggle = () => {
    const nextVal = !isToggled;
    if (onChange) {
      onChange(nextVal);
    } else {
      setInternalEnabled(nextVal);
      localStorage.setItem('hubSmartNotification', nextVal ? 'true' : 'false');
      localStorage.setItem('hubMarketingConsent', nextVal ? 'true' : 'false');
    }
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden ${className}`}>
      <div className="p-3.5 sm:p-4">
        <h2 className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-slate-900 mb-2">
          <Bell className="h-4 w-4" />
          {title}
        </h2>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="min-w-0 pr-3">
              <p className="text-xs sm:text-sm font-bold text-slate-900">{toggleLabel}</p>
              {typeof description === 'string' ? (
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {description}
                </p>
              ) : (
                <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  {description}
                </div>
              )}
            </div>
            <button
              onClick={handleToggle}
              disabled={!isLoggedIn}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors flex-shrink-0 ${
                !isLoggedIn ? 'bg-slate-200 cursor-not-allowed opacity-50' :
                isToggled ? 'bg-blue-600 cursor-pointer' : 'bg-slate-200 cursor-pointer'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  isToggled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {children && (
            <div className="pt-2 border-t border-slate-100 mt-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// -----------------------------------------
// 3. HubLogoutCard (하단 섹션: 로그아웃 및 회원탈퇴)
// -----------------------------------------
export interface HubLogoutCardProps {
  onLogout?: () => void;
  className?: string;
}

export const HubLogoutCard: React.FC<HubLogoutCardProps> = ({ onLogout, className = '' }) => {
  const { isLoggedIn } = useHub();

  const handleLogout = async () => {
    try {
      const { clearSessionToken } = await import('../CoreLogic/client');
      clearSessionToken();
    } catch (e) {}

    if (typeof window !== 'undefined') {
      localStorage.removeItem('merlin_session_token');
      localStorage.removeItem('merlin_cached_user');
      localStorage.removeItem('merlin_cached_balance');
      localStorage.removeItem('merlin_user_id');
      localStorage.removeItem('merlin_family_uid');
      sessionStorage.clear();
      // .sundreamer.app 공용 도메인 쿠키 삭제
      document.cookie = 'merlin_session_token=; path=/; max-age=0; domain=.sundreamer.app';
      document.cookie = 'merlin_session_token=; path=/; max-age=0;';
      window.dispatchEvent(new CustomEvent('merlinSessionExpired'));
      window.dispatchEvent(new Event('profileUpdated'));
      if (onLogout) {
        onLogout();
      }
      window.location.href = window.location.origin + '/';
      setTimeout(() => {
        window.location.reload();
      }, 50);
    }
  };

  if (!isLoggedIn) return null;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden ${className}`}>
      <div className="p-3.5 sm:p-4 flex flex-col gap-2">
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-xl hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          로그아웃
        </button>
      </div>
    </div>
  );
};
