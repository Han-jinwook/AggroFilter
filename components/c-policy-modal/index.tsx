'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/c-dialog'

type PolicyType = 'privacy' | 'terms'

interface PolicyModalProps {
  type: PolicyType | null
  isOpen: boolean
  onClose: () => void
}

export function PolicyModal({ type, isOpen, onClose }: PolicyModalProps) {
  const isPrivacy = type === 'privacy'

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0 gap-0 border-none shadow-2xl bg-white/95 backdrop-blur-xl">
        <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {isPrivacy ? '개인정보 처리방침' : '서비스 이용약관'}
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            최종 업데이트: {isPrivacy ? '2026년 3월 4일' : '2026년 4월 23일'}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8 pt-6 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
          <div className="prose prose-slate max-w-none prose-headings:font-bold prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900 leading-relaxed">
            {isPrivacy ? <PrivacyContent /> : <TermsContent />}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
          >
            확인
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PrivacyContent() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">1. 수집하는 개인정보</h2>
        <p>어그로필터(이하 &quot;서비스&quot;)는 다음과 같은 정보를 수집합니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
          <li><strong>이메일 주소</strong>: 로그인 및 알림 발송 목적</li>
          <li><strong>닉네임</strong>: 서비스 내 프로필 표시 목적 (선택)</li>
          <li><strong>YouTube 영상 자막 및 메타데이터</strong>: AI 신뢰도 분석 목적 (분석 요청 시에만 수집)</li>
          <li><strong>서비스 이용 기록</strong>: 분석 이력, 채널 구독 현황</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">2. 개인정보의 이용 목적</h2>
        <ul className="list-disc pl-5 space-y-1 text-slate-700">
          <li>YouTube 영상 AI 신뢰도 분석 서비스 제공</li>
          <li>채널 신뢰도 랭킹 산출 및 표시</li>
          <li>구독 채널 변화 알림 이메일 발송</li>
          <li>서비스 이용 통계 및 품질 개선</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">3. 개인정보의 보유 및 이용 기간</h2>
        <ul className="list-disc pl-5 space-y-1 text-slate-700">
          <li>회원 탈퇴 시 즉시 삭제 (단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 보관)</li>
          <li>비로그인 분석 데이터: 3년 보관 후 삭제</li>
          <li>결제 기록: 전자상거래법에 따라 5년 보관</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">4. 개인정보의 제3자 제공</h2>
        <p>서비스는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 다음의 경우는 예외로 합니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
          <li>이용자가 사전에 동의한 경우</li>
          <li>법령의 규정에 의거하거나 수사기관의 요청이 있는 경우</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">5. 크롬 확장프로그램 관련</h2>
        <p>어그로필터 크롬 확장프로그램은 다음과 같이 동작합니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
          <li>YouTube 영상 페이지에서 <strong>분석 버튼 클릭 시에만</strong> 자막·메타데이터를 서버로 전송합니다.</li>
          <li>시청 기록, 검색 기록, 로그인 정보 등은 일절 수집하지 않습니다.</li>
          <li>확장프로그램은 YouTube 및 aggrofilter.com 도메인에서만 동작합니다.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">6. 이용자의 권리</h2>
        <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
          <li>개인정보 열람, 수정, 삭제 요청</li>
          <li>서비스 탈퇴 및 데이터 삭제 요청</li>
        </ul>
        <p className="mt-2">요청은 아래 이메일로 연락 주세요.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">7. 개인정보보호 책임자 및 고객지원</h2>
        <ul className="list-none space-y-1 text-slate-700">
          <li><strong>상호명</strong>: 썬드림 주식회사</li>
          <li><strong>서비스명</strong>: 어그로필터 (AggroFilter)</li>
          <li><strong>대표자/책임자</strong>: 한진욱</li>
          <li><strong>문의 이메일</strong>: beakes@naver.com</li>
          <li><strong>웹사이트</strong>: https://aggrofilter.com</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">8. 개인정보처리방침 변경</h2>
        <p>본 방침은 법령·서비스 변경에 따라 업데이트될 수 있으며, 변경 시 서비스 내 공지합니다.</p>
      </section>
    </div>
  )
}

function TermsContent() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">1. 목적 및 회사정보</h2>
        <p>본 약관은 <strong>썬드림 주식회사</strong>(이하 &quot;회사&quot;)가 제공하는 어그로필터 서비스(이하 &quot;서비스&quot;)의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
          <li>상호: 썬드림 주식회사</li>
          <li>대표: 한진욱</li>
          <li>이메일: beakes@naver.com</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">2. 이용권 및 결제</h2>
        <p>회사는 서비스 내에서 사용 가능한 디지털 재화(이하 &quot;크레딧&quot; 또는 &quot;이용권&quot;)를 유료로 제공합니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
          <li>결제 수단: 신용카드, 휴대폰 결제 등 회사가 제공하는 결제 수단</li>
          <li>상품 형태: 결제 즉시 계정에 부여되는 디지털 콘텐츠 (배송 없음)</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">3. 청약철회 및 환불</h2>
        <p>무형의 디지털 콘텐츠의 특성상 다음과 같은 환불 규정을 따릅니다.</p>
        <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-700">
          <li>결제 후 7일 이내, 이용권을 단 1회도 사용하지 않은 경우 전액 환불이 가능합니다.</li>
          <li>이용권을 1회 이상 사용한 경우 서비스 제공이 개시된 것으로 간주하여 환불이 불가능합니다.</li>
          <li><strong>휴대폰 결제 취소</strong>: 결제 당월에 한해 취소가 가능하며, 당월 경과 후 환불 시에는 휴대폰 결제 취소가 불가능하므로 환불 수수료를 공제한 후 현금으로 환불됩니다.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">4. 서비스 이용 및 제한</h2>
        <p>회사는 이용자가 타인의 권리를 침해하거나 서비스의 정상적인 운영을 방해하는 경우 서비스 이용을 제한하거나 계정을 삭제할 수 있습니다.</p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-3">5. 관할 법원</h2>
        <p>서비스 이용과 관련하여 발생한 분쟁에 대해서는 회사의 본점 소재지를 관할하는 법원을 전용 관할 법원으로 합니다.</p>
      </section>
    </div>
  )
}
