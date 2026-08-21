'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChannelCardChannel {
  id: string
  name: string
  logoUrl?: string | null
  category?: string | null
  country?: string | null
}

export interface ChannelCardProps {
  channel: ChannelCardChannel
  favorited?: boolean
  onToggleFavorite?: () => void
  onClick?: () => void
  className?: string
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

export const ChannelCard = React.forwardRef<HTMLDivElement, ChannelCardProps>(
  (
    { channel, favorited = false, onToggleFavorite, onClick, className },
    ref,
  ) => {
    const { logoUrl } = channel
    let logoNode: React.ReactNode
    if (logoUrl && logoUrl.startsWith('emoji:')) {
      const glyph = logoUrl.slice('emoji:'.length)
      logoNode = (
        <span className="text-4xl" role="img" aria-label={channel.name}>
          {glyph}
        </span>
      )
    } else if (logoUrl && isUrl(logoUrl)) {
      logoNode = (
        <img
          src={logoUrl}
          alt={channel.name}
          className="h-full w-full object-contain"
          loading="lazy"
        />
      )
    } else {
      logoNode = (
        <span className="text-4xl" role="img" aria-label="channel">
          {'📺'}
        </span>
      )
    }

    return (
      <motion.div
        ref={ref}
        whileHover={{ y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={cn(
          'card-solid rounded-2xl p-4 cursor-pointer hover:scale-[1.02] transition-all duration-300',
          className,
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onClick()
          }
        }}
      >
        <div className="relative">
          <div className="h-20 w-full rounded-xl bg-muted flex items-center justify-center overflow-hidden">
            {logoNode}
          </div>
          {onToggleFavorite ? (
            <button
              type="button"
              aria-label={
                favorited
                  ? `Remove ${channel.name} from favorites`
                  : `Add ${channel.name} to favorites`
              }
              aria-pressed={favorited}
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite()
              }}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors focus-ring"
            >
              <Heart
                className={cn(
                  'h-4 w-4',
                  favorited
                    ? 'fill-red-500 text-red-500'
                    : 'text-foreground/60',
                )}
              />
            </button>
          ) : null}
        </div>
        <div className="mt-3">
          <p className="font-medium text-sm text-foreground truncate">
            {channel.name}
          </p>
          {channel.category ? (
            <p className="text-xs text-muted-foreground truncate">
              {channel.category}
            </p>
          ) : null}
        </div>
      </motion.div>
    )
  },
)

ChannelCard.displayName = 'ChannelCard'
