import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Explorer } from '@/components/Explorer'
import { LoadingState } from '@/components/ui/LoadingState'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Explore',
  description: 'The constellation: search a card, fly to it, follow its connections.',
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<LoadingState label="Opening the constellation" />}>
      <Explorer />
    </Suspense>
  )
}
