'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * ChannelCardSkeleton - matches the visual footprint of ChannelCard so the
 * loading state doesn't shift layout once the real cards render.
 */
export function ChannelCardSkeleton({
  className,
}: {
  className?: string
}) {
  return (
    <div
      className={cn(
        'card-solid rounded-2xl p-4',
        className,
      )}
      aria-hidden
    >
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export function ChannelCardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ChannelCardSkeleton key={i} />
      ))}
    </div>
  )
}
