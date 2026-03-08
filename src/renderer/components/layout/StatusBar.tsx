import { StatusIndicator } from '../ui/StatusIndicator'
import { useMediaStore } from '../../store/media-store'
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
  const topology = useMediaStore((s) => s.topology)

  return (
    <footer className="statusbar">
      <div className="statusbar-left">
        <StatusIndicator status={status} />
        <span className="statusbar-text">{statusText}</span>
        {topology === 'sfu' && (
          <span className="statusbar-sfu-badge">SFU</span>
        )}
      </div>
      <div className="statusbar-right">
        <span className="statusbar-version">v{version}</span>
      </div>
    </footer>
  )
}
