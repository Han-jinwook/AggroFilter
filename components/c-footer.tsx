import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-6 mt-auto">
      <div className="mx-auto max-w-[var(--app-max-width)] px-4 text-center text-xs text-slate-500 space-y-1">
        <p>법인명(상호): 썬드림 주식회사 | 대표자(성명): 백은숙 | 사업자 등록번호 안내: 333-87-00482 | 통신판매업 신고: 제 2023-인천부평-0929호</p>
        <p>주소: 21330 인천 부평구 주부토로 236 인천테크노밸리 U1센터 C동 1110호/1111호</p>
        <p>전화: 010-2597-7502 | 개인정보관리책임자: 백은숙(beakes@naver.com)</p>
        <div className="flex justify-end gap-4 pt-2">
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-primary font-medium transition-colors"
          >
            개인정보 처리방침
          </Link>
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-primary font-medium transition-colors"
          >
            이용약관
          </Link>
        </div>
      </div>
    </footer>
  )
}
