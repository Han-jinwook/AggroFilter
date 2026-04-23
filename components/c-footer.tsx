import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200 py-12">
      <div className="container mx-auto px-4 max-w-[var(--app-max-width)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900">썬드림 주식회사</h2>
            <p className="text-sm text-slate-500">© 2026 AggroFilter. All rights reserved.</p>
          </div>
          <div className="flex flex-wrap gap-4 sm:gap-8">
            <Link 
              href="/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-600 hover:text-primary transition-colors"
            >
              개인정보 처리방침
            </Link>
            <Link 
              href="/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-600 hover:text-primary transition-colors"
            >
              이용약관
            </Link>
          </div>
        </div>
        <div className="text-[12px] text-slate-400 leading-relaxed border-t border-slate-200 pt-8">
          <p>상호명: 썬드림 주식회사 | 대표자: 한진욱 | 사업자등록번호: [번호입력필요] | 통신판매업신고번호: [번호입력필요]</p>
          <p className="mt-1">주소: [주소입력필요] | 고객센터: help@aggrofilter.com | 전화: 010-2597-7502</p>
          <p className="mt-4">※ 휴대폰 결제 시 당월 취소만 가능하며, 익월 이후 취소 시에는 환불 수수료가 발생할 수 있습니다.</p>
        </div>
      </div>
    </footer>
  )
}
