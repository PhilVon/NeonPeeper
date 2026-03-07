import type { ConnectionQuality } from '../../types/media'
import './QualityIndicator.css'

interface QualityIndicatorProps {
  quality: ConnectionQuality
  showLabel?: boolean
}

const QUALITY_BARS: Record<ConnectionQuality, number> = {
  excellent: 4,
  good: 3,
  fair: 2,
  poor: 1,
}

const QUALITY_COLORS: Record<ConnectionQuality, string> = {
  excellent: 'var(--neon-green)',
  good: 'var(--neon-cyan)',
  fair: 'var(--neon-yellow)',
  poor: 'var(--neon-red)',
}

export function QualityIndicator({ quality, showLabel = false }: QualityIndicatorProps) {
  const bars = QUALITY_BARS[quality]
  const color = QUALITY_COLORS[quality]
  const heights = [4, 8, 12, 16]

  return (
    <div className="quality-indicator">
      <div className="quality-indicator-bars">
        {heights.map((h, i) => (
          <div
            key={i}
            className="quality-indicator-bar"
            style={{
              height: `${h}px`,
              background: i < bars ? color : 'var(--text-muted)',
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="quality-indicator-label" style={{ color }}>
          {quality}
        </span>
      )}
    </div>
  )
}
