import logoUrl from '../../assets/logo.png'
import './TitleBar.css'

export function TitleBar() {
  const handleMinimize = () => window.electronAPI.windowMinimize()
  const handleMaximize = () => window.electronAPI.windowMaximize()
  const handleClose = () => window.electronAPI.windowClose()

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <img src={logoUrl} alt="Neon Peeper" className="titlebar-logo" />
      </div>
      <div className="titlebar-controls">
        <button
          className="titlebar-button"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className="titlebar-button"
          onClick={handleMaximize}
          aria-label="Maximize"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          className="titlebar-button titlebar-button-close"
          onClick={handleClose}
          aria-label="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
