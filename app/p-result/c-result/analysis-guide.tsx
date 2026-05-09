"use client"

import React from 'react'
import { CheckCircle2, XCircle, Info, Sparkles, Youtube, ShieldCheck } from 'lucide-react'

export function AnalysisGuide() {
  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
      <div className="rounded-3xl border border-slate-200 bg-white/60 backdrop-blur-md p-6 md:p-8 shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-tight">분석 대기 중...</h3>
            <p className="text-sm text-slate-500">AI가 영상의 진실을 파악하고 있습니다.</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 분석 가능 영역 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-bold">분석 가능해요</span>
            </div>
            <div className="rounded-2xl bg-emerald-50/50 p-4 border border-emerald-100/50">
              <ul className="space-y-2.5 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                  <span><strong>전문 분야</strong>: 뉴스, 정치, 교육, IT, 블로그 등</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                  <span><strong>비평/논평</strong>: 유튜버의 해설과 의견이 담긴 영상</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                  <span><strong>비교/분석</strong>: 상품 리뷰나 지식 전달형 콘텐츠</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 분석 불가 영역 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rose-500">
              <XCircle className="h-5 w-5" />
              <span className="font-bold">이건 어려워요</span>
            </div>
            <div className="rounded-2xl bg-rose-50/50 p-4 border border-rose-100/50">
              <ul className="space-y-2.5 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                  <span><strong>단순 재생</strong>: M/V, 해설 없는 게임/스포츠 하이라이트</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                  <span><strong>라이브 방송</strong>: 현재 진행 중인 생중계 영상</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                  <span><strong>외국어/기타</strong>: 자막이 없거나 한국어 중심이 아닌 영상</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-100">
          <Info className="h-5 w-5 text-slate-400 shrink-0" />
          <p className="text-[13px] leading-relaxed text-slate-600">
            어그로필터는 <strong>7대 전문 카테고리</strong>와 <strong>자격 검증 로직</strong>을 통해 고품질 분석을 제공합니다. 
            단순 요약이 아닌, 영상의 진정성을 파악하기 위해 조금만 기다려 주세요!
          </p>
        </div>
      </div>
    </div>
  )
}
