import './StatusIndicator.css'

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'busy' | 'idle'
  size?: 'small' | 'medium' | 'large'
  pulse?: boolean
  label?: string
}

export function StatusIndicator({
  status,
  size = 'small',
  pulse = true,
  label
}: StatusIndicatorProps) {
  const classes = [
    'status-indicator',
    `status-indicator-${status}`,
    `status-indicator-${size}`,
    pulse && status !== 'offline' ? 'status-indicator-pulse' : ''
  ].filter(Boolean).join(' ')

  return (
    <span className="status-indicator-wrapper">
      <span className={classes} />
      {label && <span className="status-indicator-label">{label}</span>}
    </span>
  )
}
