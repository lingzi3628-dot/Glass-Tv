'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type GlassCardVariant = 'premium' | 'dark' | 'solid'

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassCardVariant
  hoverable?: boolean
}

const variantClass: Record<GlassCardVariant, string> = {
  premium: 'glass-premium',
  dark: 'glass-dark',
  solid: 'card-solid',
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ variant = 'solid', hoverable = true, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          variantClass[variant],
          'rounded-2xl p-4',
          hoverable && 'transition-all duration-300 hover:scale-[1.02]',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)

GlassCard.displayName = 'GlassCard'
