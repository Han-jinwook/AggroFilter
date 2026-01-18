import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const AnalysisListClient = dynamic(() => import('./AnalysisListClient'), {
  ssr: false,
})

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AnalysisListClient />
    </Suspense>
  )
}
