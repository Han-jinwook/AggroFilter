/**
 * Version: v2.0.1
 * Last Updated: 2026-05-23
 */
import React, { useState, useRef, useEffect } from 'react';
import { useHubAuth } from './useHubAuth';
import { triggerHaptic } from '../CoreLogic/haptic';

interface HubAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  appLogoUrl: string;
  title?: string;
  subtitleActionText?: string;
  rewardType?: 'coin' | 'point' | 'none';
  onSuccess?: (email?: string, userId?: string) => void;
}

/**
 * [Custom] 허브 통합 인증 모달 (Perfected v2.0.0 - AggroFilter Style)
 * 개별 앱에서 인증(로그인)이 필요할 때 띄우는 프리미엄 표준 모달입니다.
 * 앱 로고와 커스텀 서브타이틀을 받아 어그로필터와 동일한 세련된 UI를 제공합니다.
 */
export const HubAuthModal: React.FC<HubAuthModalProps> = ({
  isOpen,
  onClose,
  appName,
  appLogoUrl,
  title = "시작하기",
  subtitleActionText = "",
  rewardType = 'coin',
  onSuccess,
}) => {
  const { status, sendOtp, verifyOtp, timer, formatTimer, error, reset } = useHubAuth();
  const [inputEmail, setInputEmail] = useState('');
  const [emailHistory, setEmailHistory] = useState<string[]>([]);
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 모달이 열릴 때 초기화 및 이메일 히스토리 로드 (자동완성 강제 삽입 제거하여 새 가입 시 오입력 원천 차단)
  useEffect(() => {
    if (isOpen) {
      if (typeof window !== 'undefined') {
        try {
          const storedHistory = JSON.parse(localStorage.getItem('merlin_email_history') || '[]');
          const userEmail = localStorage.getItem('userEmail');
          const lastEmail = localStorage.getItem('merlin_last_email');
          
          const combined = [
            lastEmail,
            userEmail,
            ...(Array.isArray(storedHistory) ? storedHistory : [])
          ].filter((h): h is string => typeof h === 'string' && h.includes('@'));

          const uniqueEmails = Array.from(new Set(combined));
          setEmailHistory(uniqueEmails.slice(0, 4));
        } catch (_) {}
      }
    } else {
      setInputEmail('');
      setCodeDigits(['', '', '', '', '', '']);
      reset();
    }
  }, [isOpen, appName, rewardType]);

  if (!isOpen) return null;

  const isNaverOnly = appName === '썬드리머' || rewardType === 'point';

  // 실제 발송/검증에 사용될 완성된 이메일 계산
  const getFullEmail = (rawInput: string) => {
    const clean = rawInput.trim();
    if (isNaverOnly) {
      const cleanId = clean.replace(/@.*$/, '').trim();
      return cleanId ? `${cleanId}@naver.com` : '';
    }
    return clean;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;

    const targetEmail = getFullEmail(inputEmail);
    if (!targetEmail || (isNaverOnly && !targetEmail.endsWith('@naver.com')) || (!isNaverOnly && !targetEmail.includes('@'))) {
      alert(isNaverOnly ? '네이버 아이디를 입력해 주세요.' : '올바른 이메일을 입력해 주세요.');
      return;
    }

    try {
      const history = JSON.parse(localStorage.getItem('merlin_email_history') || '[]');
      const filtered = Array.isArray(history) ? history.filter((h: string) => h !== targetEmail) : [];
      const newHistory = [targetEmail, ...filtered].slice(0, 4);
      localStorage.setItem('merlin_email_history', JSON.stringify(newHistory));
      localStorage.setItem('merlin_last_email', targetEmail);
      setEmailHistory(newHistory);
    } catch (_) {}

    await sendOtp(targetEmail);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const value = rawValue.replace(/\D/g, '');
    if (value.length > 1) {
      // 모바일 인증번호 자동완성(one-time-code) 또는 붙여넣기로 복수 숫자가 유입된 경우
      const pastedDigits = value.slice(0, 6).split('');
      const newDigits = [...codeDigits];
      pastedDigits.forEach((d, i) => {
        if (i < 6) newDigits[i] = d;
      });
      setCodeDigits(newDigits);
      if (pastedDigits.length === 6) {
        handleVerify(pastedDigits.join(''));
      } else {
        const nextIndex = Math.min(pastedDigits.length, 5);
        inputRefs.current[nextIndex]?.focus();
      }
      return;
    }

    const newDigits = [...codeDigits];
    newDigits[index] = value.slice(-1);
    setCodeDigits(newDigits);
    triggerHaptic('light');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // 6자리가 모두 채워지면 자동 검증
    if (newDigits.every(d => d !== '') && newDigits.join('').length === 6) {
      handleVerify(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      const newDigits = pasted.split('');
      setCodeDigits(newDigits);
      triggerHaptic('medium');
      handleVerify(pasted);
    }
  };

  const handleVerify = async (fullCode: string) => {
    if (status === 'verifying') return;
    const targetEmail = getFullEmail(inputEmail);
    const result = await verifyOtp(fullCode, targetEmail);
    if (result && result.success) {
      triggerHaptic('success');
      const resolvedUserId = result.userId;
      if (typeof window !== 'undefined' && targetEmail) {
        try {
          const history = JSON.parse(localStorage.getItem('merlin_email_history') || '[]');
          const filtered = Array.isArray(history) ? history.filter((h: string) => h !== targetEmail) : [];
          localStorage.setItem('merlin_email_history', JSON.stringify([targetEmail, ...filtered].slice(0, 4)));
          localStorage.setItem('merlin_last_email', targetEmail);
          localStorage.setItem('userEmail', targetEmail);
          if (resolvedUserId) {
            localStorage.setItem('merlin_user_id', resolvedUserId);
          }
        } catch (_) {}
      }
      setTimeout(() => {
        if (onSuccess) onSuccess(targetEmail, resolvedUserId);
        if (onClose) onClose();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('profileUpdated'));
          window.dispatchEvent(new CustomEvent('creditsUpdated'));
        }
      }, 400);
    } else {
      triggerHaptic('error');
      // 실패 시 입력값 초기화 및 첫 번째 칸 포커스
      setCodeDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-[440px] rounded-[3rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden relative animate-in zoom-in-95 duration-300 border-none">
        
        {/* 닫기 버튼 */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-50 rounded-full z-10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        <div className="px-8 pt-8 pb-6 flex flex-col items-center">
          
          {/* 1단계: 이메일 입력 */}
          {(status === 'idle' || status === 'sending' || (status === 'error' && codeDigits.every(d => d === ''))) && (
            <div className="w-full animate-in fade-in zoom-in-95 duration-300">
              
              {/* 로고 & 타이틀 영역 */}
              <div className="flex flex-col items-center gap-3 mb-6">
                <div className="space-y-1 text-center">
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight flex flex-col sm:flex-row items-center justify-center gap-3">
                    <img
                      src={appLogoUrl}
                      alt={appName}
                      className="h-24 md:h-32 w-auto max-w-[200px] md:max-w-[250px] object-contain shrink"
                    />
                    <span className="shrink-0 whitespace-nowrap">{title}</span>
                  </h2>
                  <p className="mt-2 text-xs sm:text-[14px] text-slate-400 font-bold tracking-tight flex items-center justify-center gap-1 sm:gap-1.5 flex-nowrap whitespace-nowrap">
                    {rewardType === 'point' ? (
                      emailHistory.length > 0 ? (
                        <span>간편 본인 인증으로 안전하게 로그인하세요</span>
                      ) : (
                        <>
                          <span>지금 바로</span> 
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-xs text-xs sm:text-[13px] font-black shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 sm:w-3.5 sm:h-3.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                            5,000P
                          </span> 
                          <span>받으세요!</span>
                        </>
                      )
                    ) : rewardType === 'none' ? (
                      <>
                        {subtitleActionText ? `${subtitleActionText} 지금 바로 시작하세요` : '지금 바로 간편하게 시작하세요'}
                      </>
                    ) : (
                      emailHistory.length > 0 ? (
                        <span>간편 본인 인증으로 안전하게 로그인하세요</span>
                      ) : (
                        <>
                          <span>지금 바로</span> 
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 shadow-xs text-xs sm:text-[13px] font-black shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-coins w-3.5 h-3.5"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>
                            무료 코인
                          </span> 
                          <span>받으세요!</span>
                        </>
                      )
                    )}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSend} className="space-y-4">
                <div className="space-y-2">
                  {isNaverOnly ? (
                    <div className="space-y-1.5">
                      <div className="relative flex items-center w-full">
                        <div className="absolute left-4 w-7 h-7 rounded-lg bg-[#03C75A] text-white flex items-center justify-center font-black text-xs shrink-0 select-none shadow-xs">
                          N
                        </div>
                        <input 
                          type="text" 
                          value={inputEmail.replace(/@.*$/, '')}
                          onChange={(e) => setInputEmail(e.target.value.replace(/\s+/g, ''))}
                          placeholder="네이버 아이디 입력"
                          className="w-full h-16 bg-white border-2 border-slate-200 focus:border-[#03C75A] focus:bg-white focus:ring-8 focus:ring-[#03C75A]/10 transition-all rounded-2xl text-[16px] sm:text-lg font-black pl-13 pr-28 text-left placeholder:text-slate-300 placeholder:font-bold outline-none"
                          required
                          autoFocus
                        />
                        <span className="absolute right-4 text-xs sm:text-sm font-black text-slate-400 select-none pointer-events-none bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                          @naver.com
                        </span>
                      </div>
                      <p className="text-[11px] text-[#03C75A] font-bold text-center">
                        {emailHistory.length > 0 
                          ? '💡 네이버 아이디로 간편하게 6자리 인증을 진행해 주세요.' 
                          : '💡 네이버 카페 혜택 및 치유 포인트(5,000P) 연동을 위해 네이버 ID를 입력해 주세요.'}
                      </p>
                    </div>
                  ) : (
                    <input 
                      type="email" 
                      inputMode="email"
                      name="email"
                      autoComplete="email"
                      value={inputEmail}
                      onChange={(e) => setInputEmail(e.target.value)}
                      placeholder="이메일 주소 입력 (example@email.com)"
                      className="w-full h-16 bg-white border-2 border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-8 focus:ring-blue-500/5 transition-all rounded-2xl text-[15px] sm:text-base font-bold px-6 text-center placeholder:text-slate-300 placeholder:font-medium outline-none"
                      required
                      autoFocus
                    />
                  )}
                  
                  {/* 최근 사용 이메일 빠른 선택 칩 */}
                  {emailHistory.length > 0 && (
                    <div className="flex flex-col items-center gap-1.5 pt-1 animate-in fade-in duration-200">
                      <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                        <span>✉️</span> 최근 사용한 계정
                      </span>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {emailHistory.map((email) => {
                          const displayLabel = isNaverOnly && email.endsWith('@naver.com') ? email.replace('@naver.com', '') : email;
                          return (
                            <button
                              key={email}
                              type="button"
                              onClick={() => setInputEmail(isNaverOnly ? email.replace('@naver.com', '') : email)}
                              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all border cursor-pointer ${
                                (isNaverOnly ? inputEmail.replace(/@.*$/, '') === displayLabel : inputEmail === email)
                                  ? 'bg-[#03C75A] text-white border-[#03C75A] shadow-sm'
                                  : 'bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 text-slate-600 hover:text-emerald-700 border-slate-200/70'
                              }`}
                            >
                              {displayLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                
                {error && (
                  <div className="bg-rose-50 text-rose-500 text-sm font-bold py-4 px-6 rounded-2xl border border-rose-100 text-center">
                    {error}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={status === 'sending'}
                  className={`w-full h-16 text-white font-black text-xl rounded-2xl shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer ${
                    isNaverOnly
                      ? 'bg-[#03C75A] hover:bg-[#02b350] shadow-[#03C75A]/20'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  }`}
                >
                  {status === 'sending' ? '발송 중...' : '인증코드 받기'}
                </button>
              </form>
            </div>
          )}

          {/* 2단계: 코드 입력 */}
          {(status === 'sent' || status === 'verifying' || (status === 'error' && codeDigits.some(d => d !== ''))) && (
            <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl mb-2">
                  <span className="text-3xl">📧</span>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">인증코드를 입력해주세요</h3>
                <div className="space-y-1">
                  <p className="text-base text-slate-400 font-bold">
                    <span className="text-blue-600 font-black">{getFullEmail(inputEmail)}</span>로<br/>
                    6자리 코드를 발송했습니다.
                  </p>
                  <p className="text-[11px] text-slate-400 font-bold tracking-tight opacity-70 flex items-center justify-center gap-2">
                    통합계정센터 <span className="text-slate-300">|</span> 
                    <span className="text-slate-500 font-mono">os.sundreamer.app</span>
                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{formatTimer()}</span>
                  </p>
                </div>
              </div>

              <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                {codeDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={i === 0 ? 6 : 1}
                    value={digit}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className={`w-10 h-14 sm:w-12 sm:h-16 text-center text-2xl sm:text-3xl font-black border-2 sm:border-3 rounded-2xl outline-none transition-all ${
                      digit 
                        ? 'border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-500/10' 
                        : 'border-slate-200 bg-white text-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-400/5'
                    }`}
                    disabled={status === 'verifying'}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  type="button" 
                  onClick={() => sendOtp(getFullEmail(inputEmail))} 
                  disabled={status === 'verifying'}
                  className="h-14 border-2 border-slate-100 text-slate-600 font-black text-base rounded-xl hover:bg-slate-50 hover:border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  🔄 인증코드 재발송
                </button>
                <button 
                  type="button" 
                  onClick={() => { reset(); setCodeDigits(['','','','','','']); }} 
                  className="h-12 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors"
                >
                  다른 이메일 주소 사용하기
                </button>
              </div>

              {error && (
                <div className="bg-rose-50 text-rose-500 text-sm font-bold py-4 px-6 rounded-2xl border border-rose-100 text-center">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* 3단계: 성공 */}
          {status === 'success' && (
            <div className="w-full text-center space-y-6 animate-in zoom-in duration-300 py-8">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-green-50 text-green-500 rounded-full mb-2">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">인증 완료!</h3>
                <p className="text-base text-slate-500 font-bold">로그인이 성공적으로 완료되었습니다.</p>
              </div>
            </div>
          )}

          {/* 하단 브랜딩 (공통) */}
          <div className="text-center mt-6">
            <span className="text-[11px] text-slate-400 font-bold tracking-tight">
              시작 시 서비스 정책에 동의하게 됩니다.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
