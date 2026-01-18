import dynamic from 'next/dynamic'
import { Suspense } from 'react'

const MyPageClient = dynamic(() => import('./MyPageClient'), {
  ssr: false,
})

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MyPageClient />
    </Suspense>
  )
}
