'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type GradientButtonSize = 'sm' | 'md' | 'lg'

export interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: GradientButtonSize
}

const sizeClass: Record<GradientButtonSize, string> = {
  sm: 'btn-gradient-sm',
  md: 'btn-gradient',
  lg: 'btn-gradient text-lg px-8 py-4 rounded-2xl',
}

export const GradientButton = React.forwardRef<
  HTMLButtonElement,
  GradientButtonProps
>(
  (
    { size = 'md', className, children, type = 'button', ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'focus-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-300',
          sizeClass[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)

GradientButton.displayName = 'GradientButton'
