import Link from "next/link"
import { ArrowRight, LayoutGrid, Palette, Zap } from "lucide-react"

export default function DesignTestPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-2 text-4xl font-bold text-slate-900">Design Lab 🧪</h1>
        <p className="mb-12 text-lg text-slate-600">
          AggroFilter의 UI/UX를 위한 실험실입니다. 다양한 시안을 테스트해보세요.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* V1 Card */}
          <Link
            href="/design-test/v1"
            className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-100 transition-transform group-hover:scale-150" />
            <div className="relative z-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-blue-200">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-slate-900">Concept V1</h2>
              <p className="mb-4 font-medium text-blue-600">Modern & Clean</p>
              <p className="text-sm text-slate-500">
                정보의 구조화를 최우선으로 한 베토 그리드 스타일. 깔끔한 카드 UI와 부드러운 그림자를 사용했습니다.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-900">
              View Design <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Updated V2 card to link to the new Pro design */}
          <Link
            href="/design-test/v2"
            className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-slate-100 transition-transform group-hover:scale-150" />
            <div className="relative z-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-slate-200">
                <Zap className="h-6 w-6" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-slate-900">Concept V2</h2>
              <p className="mb-4 font-medium text-slate-600">Professional Analyst</p>
              <p className="text-sm text-slate-500">
                주식/금융 앱 스타일의 고밀도 정보 디자인. 강렬한 대비와 명확한 선을 사용하여 신뢰감을 줍니다.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-900">
              View Design <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* V3 Card */}
          <Link
            href="/design-test/v3"
            className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-50 transition-transform group-hover:scale-150" />
            <div className="relative z-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-white shadow-emerald-100">
                <Palette className="h-6 w-6" />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-slate-900">Concept V3</h2>
              <p className="mb-4 font-medium text-emerald-600">Soft Minimal</p>
              <p className="text-sm text-slate-500">
                앱 같은 부드러운 감성의 미니멀 디자인. 파스텔 톤, 글래스 효과, 둥근 모서리를 극대화했습니다.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-900">
              View Design <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
