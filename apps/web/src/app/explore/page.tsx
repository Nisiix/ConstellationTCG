import { Suspense } from 'react'
import { Explorer } from '@/components/Explorer'
import { LoadingState } from '@/components/ui/LoadingState'

export const dynamic = 'force-dynamic'

export default function ExplorePage() {
  return (
    <Suspense fallback={<LoadingState label="Opening the constellation" />}>
      <Explorer />
    </Suspense>
  )
}
