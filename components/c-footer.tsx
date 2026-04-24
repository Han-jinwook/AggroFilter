import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 mt-auto">
      <div className="mx-auto max-w-[var(--app-max-width)] px-6 py-8">
        {/* 상단: 브랜드 + 약관 링크 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">썬드림 주식회사</h3>
            <p className="mt-0.5 text-xs text-slate-500">AI 유튜브 신뢰도 분석 서비스 · 어그로필터</p>
          </div>
          <nav className="flex items-center gap-5 text-xs font-medium">
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-700 hover:text-primary transition-colors"
            >
              개인정보 처리방침
            </Link>
            <span className="h-3 w-px bg-slate-300" aria-hidden />
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-primary transition-colors"
            >
              이용약관
            </Link>
          </nav>
        </div>

        {/* 구분선 */}
        <div className="my-5 h-px bg-slate-200" />

        {/* 하단: 사업자 정보 */}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[11px] leading-relaxed text-slate-500 sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-400">대표자</dt>
            <dd>백은숙</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-400">사업자등록번호</dt>
            <dd>333-87-00482</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-400">통신판매업신고</dt>
            <dd>제 2023-인천부평-0929호</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-slate-400">개인정보관리책임자</dt>
            <dd>
              백은숙{' '}
              <a href="mailto:beakes@naver.com" className="hover:text-primary">
                (beakes@naver.com)
              </a>
            </dd>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 text-slate-400">주소</dt>
            <dd>21330 인천 부평구 주부토로 236 인천테크노밸리 U1센터 C동 1110호/1111호</dd>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 text-slate-400">고객문의</dt>
            <dd>
              <a href="tel:07074242695" className="hover:text-primary">070-7424-2695</a>
              <span className="mx-2 text-slate-300">/</span>
              <a href="mailto:chiu3@naver.com" className="hover:text-primary">chiu3@naver.com</a>
            </dd>
          </div>
        </dl>

        {/* 저작권 */}
        <p className="mt-6 text-[11px] text-slate-400">
          © {new Date().getFullYear()} 썬드림 주식회사. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
