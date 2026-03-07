import { StatusIndicator } from '../ui/StatusIndicator'
import './StatusBar.css'

interface StatusBarProps {
  status?: 'online' | 'offline' | 'busy'
  statusText?: string
  version?: string
}

export function StatusBar({
  status = 'online',
  statusText = 'Ready',
  version = '1.0.0'
}: StatusBarProps) {
  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <StatusIndicator status={status} />
        <span className="statusbar-text">{statusText}</span>
      </div>
      <div className="statusbar-right">
        <span className="statusbar-version">v{version}</span>
      </div>
    </footer>
  )
}
