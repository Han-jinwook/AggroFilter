import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const ResultClient = dynamic(() => import('./ResultClient'), {
  ssr: false,
})

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResultClient />
    </Suspense>
  )
}
