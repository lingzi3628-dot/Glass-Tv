'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type GlassButtonVariant =
  | 'primary'
  | 'secondary'
  | 'glass'
  | 'gradient'
  | 'ghost'

export type GlassButtonSize = 'sm' | 'md' | 'lg' | 'icon'

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant
  size?: GlassButtonSize
}

const variantClass: Record<GlassButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary:
    'bg-card text-foreground border border-border hover:bg-muted',
  glass: 'glass-premium text-foreground',
  gradient: 'btn-gradient',
  ghost: 'transparent hover:bg-muted',
}

const sizeClass: Record<GlassButtonSize, string> = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-6 py-3 text-base rounded-xl',
  lg: 'px-8 py-4 text-lg rounded-2xl',
  icon: 'p-2 rounded-lg',
}

export const GlassButton = React.forwardRef<
  HTMLButtonElement,
  GlassButtonProps
>(
  (
    {
      variant = 'primary',
      size = 'md',
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'focus-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all duration-300 font-semibold',
          variantClass[variant],
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

GlassButton.displayName = 'GlassButton'
