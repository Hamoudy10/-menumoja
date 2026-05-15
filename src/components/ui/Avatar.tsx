'use client'

import { useState } from 'react'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'
type StatusDot = 'online' | 'offline' | 'busy' | 'none'

interface AvatarProps {
  src?: string | null
  alt?: string
  name?: string
  size?: AvatarSize
  status?: StatusDot
  className?: string
}

const sizeStyles: Record<AvatarSize, { container: string; text: string }> = {
  sm: { container: 'h-8 w-8', text: 'text-xs' },
  md: { container: 'h-10 w-10', text: 'text-sm' },
  lg: { container: 'h-14 w-14', text: 'text-lg' },
  xl: { container: 'h-20 w-20', text: 'text-2xl' },
}

const statusColors: Record<string, string> = {
  online: 'bg-success',
  offline: 'bg-gray-400',
  busy: 'bg-red-500',
}

const statusSizes: Record<AvatarSize, string> = {
  sm: 'h-2.5 w-2.5 right-0 bottom-0',
  md: 'h-3 w-3 right-0 bottom-0',
  lg: 'h-3.5 w-3.5 right-0.5 bottom-0.5',
  xl: 'h-4 w-4 right-1 bottom-1',
}

function getInitials(name?: string): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const avatarColors = [
  'bg-secondary',
  'bg-primary',
  'bg-accent',
  'bg-green-500',
  'bg-blue-500',
  'bg-purple-500',
]

function getColorFromName(name?: string): string {
  if (!name) return avatarColors[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

export function Avatar({
  src,
  alt = '',
  name,
  size = 'md',
  status = 'none',
  className = '',
}: AvatarProps) {
  const [imgError, setImgError] = useState(false)
  const showInitials = !src || imgError
  const color = getColorFromName(name)

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`
          relative flex items-center justify-center overflow-hidden rounded-full
          ${sizeStyles[size].container}
          ${showInitials ? color : ''}
        `}
      >
        {!showInitials ? (
          <img
            src={src!}
            alt={alt || name || 'Avatar'}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className={`font-accent font-bold text-white ${sizeStyles[size].text}`}
          >
            {getInitials(name)}
          </span>
        )}
      </div>
      {status !== 'none' && (
        <span
          className={`
            absolute rounded-full border-2 border-white dark:border-primary-light
            ${statusColors[status]}
            ${statusSizes[size]}
          `}
        />
      )}
    </div>
  )
}
