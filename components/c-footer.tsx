'use client'

import React, { useState } from 'react'
import { PolicyModal } from './c-policy-modal'

export function Footer() {
  const [policyType, setPolicyType] = useState<'privacy' | 'terms' | null>(null)

  return (
    <footer className="border-t border-slate-200 bg-slate-50 mt-auto">
      <div className="mx-auto max-w-[var(--app-max-width)] px-6 py-8">
        {/* 상단: 브랜드 + 약관 링크 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">썬드림 주식회사</h3>
            <p className="mt-0.5 text-xs text-slate-600">AI 유튜브 신뢰도 분석 서비스 · 어그로필터</p>
          </div>
          <nav className="flex items-center gap-5 text-xs font-semibold">
            <button
              onClick={() => setPolicyType('privacy')}
              className="text-slate-800 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0 font-semibold"
            >
              개인정보 처리방침
            </button>
            <span className="h-3 w-px bg-slate-300" aria-hidden />
            <button
              onClick={() => setPolicyType('terms')}
              className="text-slate-800 hover:text-primary transition-colors cursor-pointer bg-transparent border-none p-0 font-semibold"
            >
              이용약관
            </button>
          </nav>
        </div>

        <PolicyModal
          type={policyType}
          isOpen={!!policyType}
          onClose={() => setPolicyType(null)}
        />

        {/* 구분선 */}
        <div className="my-5 h-px bg-slate-200" />

        {/* 하단: 사업자 정보 (3줄) */}
        <div className="space-y-1.5 text-xs leading-relaxed text-slate-700">
          <p>
            <span className="text-slate-500">대표자</span> 백은숙
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-slate-500">사업자등록번호</span> 333-87-00482
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-slate-500">통신판매업신고</span> 제 2023-인천부평-0929호
          </p>
          <p>
            <span className="text-slate-500">주소</span> 21330 인천 부평구 주부토로 236 인천테크노밸리 U1센터 C동 1110호/1111호
          </p>
          <p>
            <span className="text-slate-500">개인정보관리책임자</span> 백은숙
            <a href="mailto:beakes@naver.com" className="ml-1 hover:text-primary">(beakes@naver.com)</a>
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-slate-500">고객문의</span>{' '}
            <a href="tel:07074242695" className="hover:text-primary">070-7424-2695</a>
            <span className="mx-1.5 text-slate-300">/</span>
            <a href="mailto:chiu3@naver.com" className="hover:text-primary">chiu3@naver.com</a>
          </p>
        </div>

        {/* 저작권 */}
        <p className="mt-5 text-xs text-slate-500">
          © {new Date().getFullYear()} 썬드림 주식회사. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
