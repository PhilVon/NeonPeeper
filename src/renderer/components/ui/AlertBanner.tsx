import { HTMLAttributes, ReactNode } from 'react'
import './AlertBanner.css'

interface AlertBannerProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  dismissible?: boolean
  onDismiss?: () => void
  icon?: ReactNode
}

const defaultIcons: Record<string, string> = {
  info: '●',
  success: '✓',
  warning: '⚠',
  error: '✖',
}

export function AlertBanner({
  variant = 'info',
  title,
  dismissible = false,
  onDismiss,
  icon,
  className = '',
  children,
  ...props
}: AlertBannerProps) {
  const classes = [
    'alert-banner',
    `alert-banner-${variant}`,
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} role="alert" {...props}>
      <span className="alert-banner-icon">
        {icon ?? defaultIcons[variant]}
      </span>
      <div className="alert-banner-content">
        {title && <div className="alert-banner-title">{title}</div>}
        {children && <div className="alert-banner-message">{children}</div>}
      </div>
      {dismissible && (
        <button
          className="alert-banner-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  )
}
