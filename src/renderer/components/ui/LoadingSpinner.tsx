import { HTMLAttributes } from 'react'
import './LoadingSpinner.css'

interface LoadingSpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'small' | 'medium' | 'large'
  color?: 'cyan' | 'green' | 'magenta' | 'red'
}

export function LoadingSpinner({
  size = 'medium',
  color = 'cyan',
  className = '',
  ...props
}: LoadingSpinnerProps) {
  const classes = [
    'loading-spinner',
    `loading-spinner-${size}`,
    `loading-spinner-${color}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} {...props}>
      <div className="loading-spinner-bar" />
      <div className="loading-spinner-bar" />
      <div className="loading-spinner-bar" />
    </div>
  )
}
