import { HTMLAttributes } from 'react'
import './NeonCard.css'

interface NeonCardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  glow?: boolean
  glowColor?: 'cyan' | 'green' | 'magenta'
}

export function NeonCard({
  title,
  glow = false,
  glowColor = 'cyan',
  className = '',
  children,
  ...props
}: NeonCardProps) {
  const classes = [
    'neon-card',
    glow ? `neon-card-glow neon-card-glow-${glowColor}` : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} {...props}>
      {title && <div className="neon-card-header">{title}</div>}
      <div className="neon-card-content">{children}</div>
    </div>
  )
}
