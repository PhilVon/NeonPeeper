import { StatusIndicator } from '../ui/StatusIndicator'
import packageJson from '../../../../package.json'
import './StatusBar.css'

interface StatusBarProps {
  status?: 'online' | 'offline' | 'busy'
  statusText?: string
  version?: string
}

export function StatusBar({
  status = 'online',
  statusText = 'Ready',
  version = packageJson.version
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
