import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const RankingClient = dynamic(() => import('./RankingClient'), {
  ssr: false,
})

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RankingClient />
    </Suspense>
  )
}
