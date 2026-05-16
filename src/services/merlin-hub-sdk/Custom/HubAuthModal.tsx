'use client';

/**
 * Version: v1.0.0
 * Last Updated: 2026-05-15
 */
import React, { useState } from 'react';
import { useHubAuth } from '../Core/useHubAuth';

interface HubAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  appLogoUrl: string;
  onSuccess?: () => void;
}

/**
 * [Custom] 허브 통합 인증 모달
 * 개별 앱에서 인증(로그인)이 필요할 때 띄우는 표준 모달입니다.
 */
export const HubAuthModal: React.FC<HubAuthModalProps> = ({
  isOpen,
  onClose,
  appName,
  appLogoUrl,
  onSuccess,
}) => {
  const { status, sendOtp, verifyOtp, timer, formatTimer, error, reset } = useHubAuth();
  const [inputEmail, setInputEmail] = useState('');
  const [inputCode, setInputCode] = useState('');

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtp(inputEmail);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await verifyOtp(inputCode);
    if (success && onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200">

        {/* 닫기 버튼 */}
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        <div className="p-8 md:p-10 flex flex-col items-center">
          {/* 앱 로고 섹션 */}
          <div className="w-16 h-16 bg-white rounded-2xl p-2 shadow-sm border border-gray-100 mb-6">
            <img src={appLogoUrl} alt={appName} className="w-full h-full object-contain" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">{appName}</h2>
          <p className="text-gray-500 text-sm mb-8">이메일 인증으로 모든 기능을 이용하세요</p>

          {/* 1단계: 이메일 입력 */}
          {(status === 'idle' || status === 'sending' || status === 'error' && !inputCode) && (
            <form onSubmit={handleSend} className="w-full space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 ml-1">이메일 주소</label>
                <input
                  type="email"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-500 focus:bg-white outline-none transition-all text-lg"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={status === 'sending'}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {status === 'sending' ? '발송 중...' : '인증코드 받기'}
              </button>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            </form>
          )}

          {/* 2단계: 코드 입력 */}
          {(status === 'sent' || status === 'verifying' || (status === 'error' && inputCode)) && (
            <form onSubmit={handleVerify} className="w-full space-y-6">
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-blue-600">인증코드를 입력해주세요</p>
                <p className="text-xs text-gray-400">{inputEmail}로 코드를 발송했습니다.</p>
                <div className="text-xl font-mono font-bold text-blue-500">{formatTimer()}</div>
              </div>

              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.slice(0, 6))}
                placeholder="6자리 코드 입력"
                className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:border-blue-500 focus:bg-white outline-none transition-all text-center text-3xl tracking-[0.5em] font-bold"
                required
              />

              <button
                type="submit"
                disabled={status === 'verifying' || timer === 0}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {status === 'verifying' ? '확인 중...' : '인증 완료'}
              </button>

              <div className="flex justify-center gap-4 text-xs font-medium text-gray-400">
                <button type="button" onClick={() => sendOtp(inputEmail)} className="hover:text-blue-500 underline">코드 재발송</button>
                <button type="button" onClick={reset} className="hover:text-blue-500 underline">이메일 변경</button>
              </div>

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            </form>
          )}

          {/* 하단 브랜딩 */}
          <div className="mt-10 pt-6 border-t border-gray-50 w-full text-center">
            <span className="text-[10px] text-gray-300 font-medium tracking-widest uppercase">
              Powered by <span className="text-gray-400">sundreamer.app</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
