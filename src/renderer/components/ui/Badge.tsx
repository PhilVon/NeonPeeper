import { HTMLAttributes } from 'react'
import './Badge.css'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'small' | 'medium'
  glow?: boolean
}

export function Badge({
  variant = 'default',
  size = 'medium',
  glow = false,
  className = '',
  children,
  ...props
}: BadgeProps) {
  const classes = [
    'badge',
    `badge-${variant}`,
    `badge-${size}`,
    glow && 'badge-glow',
    className
  ].filter(Boolean).join(' ')

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  )
}
