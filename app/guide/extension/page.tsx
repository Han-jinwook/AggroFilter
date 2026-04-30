'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { 
  ExternalLink, 
  Puzzle, 
  Youtube, 
  CheckCircle2,
  ArrowRight,
  Info,
  Monitor,
  LayoutDashboard,
  ArrowLeft
} from 'lucide-react'
import { AppHeader } from '@/components/c-app-header'

const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/%EC%96%B4%EA%B7%B8%EB%A1%9C%ED%95%84%ED%84%B0-ai-%EC%9C%A0%ED%8A%9C%EB%B8%8C-%EC%8B%A0%EB%A2%B0%EB%8F%84-%EB%B6%84%EC%84%9D/mjhggligjfhieppaeendaikkdpnbkdke?utm_source=ext_app_menu'

export default function ExtensionGuidePage() {
  return (
    <div className="min-h-screen bg-slate-50/50">
      <AppHeader />
      <main className="mx-auto w-full max-w-[var(--app-max-width)] px-4 pt-6 pb-12">
        <div className="space-y-8">
          {/* 상단 네비게이션 */}
          <div className="flex items-center justify-start">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-white hover:text-blue-600 hover:border-blue-200 hover:shadow-md active:scale-95 group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              홈으로 돌아가기
            </Link>
          </div>
        {/* 헤더 섹션 */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight md:text-5xl">
            어그로필터 설치 <span className="text-blue-600 italic underline decoration-blue-200 underline-offset-8">3클릭</span>
          </h1>
          
          <div className="pt-4">
            <a
              href={CHROME_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-blue-200 transition-all hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Monitor className="w-5 h-5" />
              크롬에 추가하기 (무료)
            </a>
          </div>
        </div>

        {/* 스테퍼 섹션 */}
        <div className="space-y-32">
          {/* Step 1 */}
          <div className="relative">
            <div className="absolute -left-3 -top-10 text-[120px] font-black text-slate-50 leading-none select-none -z-10">01</div>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 text-blue-600 font-bold">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black">1</span>
                  웹스토어 이동
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">크롬 웹스토어 페이지 접속</h3>
                <p className="text-slate-600 leading-relaxed">
                  위의 <strong className="text-blue-600">크롬에 추가하기</strong> 버튼을 눌러 공식 웹스토어 페이지로 이동합니다. 
                  우측 상단의 파란색 <strong className="text-slate-900">Chrome에 추가</strong> 버튼을 클릭하세요.
                </p>
              </div>
              <div className="group relative rounded-2xl border-8 border-white shadow-2xl shadow-blue-100 overflow-hidden transition-transform hover:scale-[1.02]">
                <img 
                  src="/images/guide/store_main.png" 
                  alt="Chrome Web Store Main" 
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-transparent transition-colors" />
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative">
            <div className="absolute -left-3 -top-10 text-[120px] font-black text-slate-50 leading-none select-none -z-10">02</div>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1 group relative rounded-2xl border-8 border-white shadow-2xl shadow-blue-100 overflow-hidden transition-transform hover:scale-[1.02]">
                <img 
                  src="/images/guide/permission_popup.png" 
                  alt="Permission Popup" 
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-transparent transition-colors" />
              </div>
              <div className="order-1 md:order-2 space-y-5">
                <div className="inline-flex items-center gap-2 text-blue-600 font-bold">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black">2</span>
                  권한 승인
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">확장 프로그램 추가 승인</h3>
                <p className="text-slate-600 leading-relaxed">
                  버튼을 누르면 상단에 확인 팝업이 나타납니다. <br />
                  <strong className="text-slate-900">확장 프로그램 추가</strong> 버튼을 클릭하여 설치를 완료해 주세요.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative">
            <div className="absolute -left-3 -top-10 text-[120px] font-black text-slate-50 leading-none select-none -z-10">03</div>
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 text-blue-600 font-bold">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black">3</span>
                  분석 실행
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">유튜브에서 바로 분석하기</h3>
                <p className="text-slate-600 leading-relaxed">
                  이제 유튜브 영상 페이지로 이동하면 좋아요 버튼 옆에 <strong className="text-blue-600">어그로필터</strong> 버튼이 생성됩니다. 
                  클릭 한 번으로 AI가 영상의 신뢰도를 즉시 분석합니다.
                </p>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-800 leading-relaxed">
                    분석 결과는 자동으로 저장되며, <br />
                    언제든지 대시보드에서 다시 볼 수 있습니다.
                  </p>
                </div>
              </div>
              <div className="group relative rounded-2xl border-8 border-white shadow-2xl shadow-blue-100 overflow-hidden transition-transform hover:scale-[1.02]">
                <img 
                  src="/images/guide/usage_youtube.png" 
                  alt="YouTube Usage" 
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-blue-600/5 group-hover:bg-transparent transition-colors" />
              </div>
            </div>
          </div>
        </div>

        {/* 하단 푸터 */}
        <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-white hover:text-blue-600 hover:border-blue-200 hover:shadow-md active:scale-95 group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              홈으로 돌아가기
            </Link>
          </div>
          <p className="text-xs text-slate-400">
            도움이 필요하신가요? <a href="mailto:beakes@naver.com" className="underline hover:text-blue-600">beakes@naver.com</a>
          </p>
        </div>
      </div>
      </main>
    </div>
  )
}
