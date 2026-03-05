export const metadata = {
  title: '크롬 확장프로그램 설치 가이드 | 어그로필터',
  description: '어그로필터 크롬 확장프로그램 설치 및 사용 가이드',
}

import Link from 'next/link'

export default function ExtensionGuidePage() {
  return (
    <main className="mx-auto w-full max-w-[var(--app-max-width)] px-4 py-10">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-balance text-2xl font-extrabold text-slate-900 md:text-3xl">
            크롬 확장프로그램 설치 가이드
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            PC 크롬에서 유튜브를 보다가, 영상 페이지에서 바로 분석을 시작할 수 있어요.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">1) 설치 (개발자 모드)</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
            <li>
              크롬 주소창에
              <span className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px]">chrome://extensions</span>
              를 입력해서 이동합니다.
            </li>
            <li>오른쪽 상단의 “개발자 모드”를 켭니다.</li>
            <li>“압축해제된 확장 프로그램을 로드합니다”를 누릅니다.</li>
            <li>
              프로젝트 폴더 안의
              <span className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px]">chrome-extension</span>
              폴더를 선택합니다.
            </li>
          </ol>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            웹스토어 정식 배포가 완료되면, 더 간단한 “설치하기” 방식으로 안내할 예정입니다.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">2) 사용 방법</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
            <li>유튜브 영상 페이지로 이동합니다. (일반 영상 / Shorts 모두 지원)</li>
            <li>영상 아래에 나타나는 “어그로필터 분석” 버튼을 눌러 분석을 시작합니다.</li>
            <li>결과 카드에서 “상세 분석 보기”를 누르면 웹사이트 결과 페이지로 이동합니다.</li>
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900">3) 모바일에서는 무엇을 하나요?</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            모바일(PWA)에서는 분석을 “실행”하기보다, PC에서 분석한 결과를 편하게 조회하고 관리하는 데 집중합니다.
            필요하면 재분석을 요청할 수 있어요.
          </p>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            홈으로 돌아가기
          </Link>
          <Link
            href="/p-my-page?tab=analysis"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-slate-50"
          >
            내 분석 결과 보기
          </Link>
        </div>
      </div>
    </main>
  )
}
