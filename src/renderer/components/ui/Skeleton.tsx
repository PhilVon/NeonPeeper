import { HTMLAttributes } from 'react'
import './Skeleton.css'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  lines?: number
  shimmer?: boolean
}

function toCSS(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'number' ? `${value}px` : value
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  lines = 1,
  shimmer = true,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const baseClasses = [
    'skeleton',
    `skeleton-${variant}`,
    shimmer ? 'skeleton-shimmer' : '',
    className
  ].filter(Boolean).join(' ')

  if (variant === 'text' && lines > 1) {
    return (
      <div className="skeleton-lines" {...props}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={baseClasses}
            style={{
              width: i === lines - 1 ? '70%' : toCSS(width) || '100%',
              height: toCSS(height),
              ...style
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={baseClasses}
      style={{
        width: toCSS(width),
        height: toCSS(height),
        ...style
      }}
      {...props}
    />
  )
}
