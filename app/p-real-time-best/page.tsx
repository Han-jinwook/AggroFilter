import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const RealTimeBestClient = dynamic(() => import('./RealTimeBestClient'), {
  ssr: false,
})

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RealTimeBestClient />
    </Suspense>
  )
}
