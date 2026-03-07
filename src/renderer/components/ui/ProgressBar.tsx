import { HTMLAttributes } from 'react'
import './ProgressBar.css'

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number
  variant?: 'cyan' | 'green' | 'magenta' | 'red'
  size?: 'small' | 'medium' | 'large'
  glow?: boolean
  showLabel?: boolean
  animated?: boolean
}

export function ProgressBar({
  value,
  variant = 'cyan',
  size = 'medium',
  glow = false,
  showLabel = false,
  animated = false,
  className = '',
  ...props
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value))

  const classes = [
    'progress-bar',
    `progress-bar-${variant}`,
    `progress-bar-${size}`,
    glow ? 'progress-bar-glow' : '',
    className
  ].filter(Boolean).join(' ')

  const fillClasses = [
    'progress-bar-fill',
    animated ? 'progress-bar-animated' : ''
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <div className="progress-bar-track">
        <div
          className={fillClasses}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {showLabel && (
        <span className="progress-bar-label">{Math.round(clampedValue)}%</span>
      )}
    </div>
  )
}
