export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-6 mt-auto">
      <div className="mx-auto max-w-[var(--app-max-width)] px-4 text-center text-xs text-slate-500 space-y-1">
        <p className="font-bold text-slate-700">썬드림 주식회사</p>
        <p>사업자등록번호: 333-87-00482</p>
        <p>© {new Date().getFullYear()} 어그로필터 (AggroFilter). All rights reserved.</p>
        <p className="pt-2 text-[10px] text-slate-400">
          문의: support@aggrofilter.com
        </p>
      </div>
    </footer>
  )
}
