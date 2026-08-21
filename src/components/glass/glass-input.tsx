'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface GlassInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const GlassInput = React.forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const reactId = React.useId()
    const inputId = id ?? reactId

    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground/80 mb-1.5"
          >
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-4 py-3 bg-card border border-border rounded-xl placeholder:text-muted-foreground text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
            error &&
              'border-destructive focus:ring-destructive focus:border-transparent',
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {error ? (
          <p className="text-sm text-destructive mt-1">{error}</p>
        ) : null}
      </div>
    )
  },
)

GlassInput.displayName = 'GlassInput'
