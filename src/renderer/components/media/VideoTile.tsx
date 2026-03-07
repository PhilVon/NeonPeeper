import { useEffect, useRef } from 'react'
import { Avatar } from '../ui/Avatar'
import { useSpeakingDetection } from '../../hooks/useSpeakingDetection'
import './VideoTile.css'

interface VideoTileProps {
  stream: MediaStream | null
  name: string
  muted?: boolean
  mirrored?: boolean
  videoEnabled?: boolean
  isActiveSpeaker?: boolean
  showQuality?: boolean
  qualityBars?: number
  objectFit?: 'cover' | 'contain'
}

export function VideoTile({
  stream,
  name,
  muted = false,
  mirrored = false,
  videoEnabled = true,
  isActiveSpeaker = false,
  showQuality = false,
  qualityBars = 4,
  objectFit = 'cover',
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const tileRef = useRef<HTMLDivElement>(null)
  const { isSpeaking } = useSpeakingDetection(stream, tileRef)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      if (stream) {
        videoRef.current.play().catch(() => {})
      }
    }
  }, [stream, videoEnabled])

  const hasVideo = stream && videoEnabled && stream.getVideoTracks().some((t) => t.enabled)
  const speaking = isSpeaking || isActiveSpeaker

  return (
    <div
      ref={tileRef}
      className={[
        'video-tile',
        speaking && 'video-tile-speaking',
        mirrored && 'video-tile-mirrored',
      ].filter(Boolean).join(' ')}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={[
          'video-tile-video',
          objectFit === 'contain' && 'video-tile-contain',
          !hasVideo && 'video-tile-video-hidden',
        ].filter(Boolean).join(' ')}
      />
      {!hasVideo && (
        <div className="video-tile-avatar">
          <Avatar name={name} size="large" />
        </div>
      )}
      <div className="video-tile-vu-bar" />
      {speaking && <div key={Date.now()} className="video-tile-speak-ripple" />}
      <div className="video-tile-overlay">
        <span className="video-tile-name">{name}</span>
        {muted && <span className="video-tile-muted" title="Muted">🔇</span>}
        {showQuality && (
          <QualityBars bars={qualityBars} />
        )}
      </div>
    </div>
  )
}

function QualityBars({ bars }: { bars: number }) {
  const heights = [2, 4, 6, 8]
  const color = bars >= 3 ? 'var(--neon-green)' : bars >= 2 ? 'var(--neon-yellow)' : 'var(--neon-red)'

  return (
    <div className="quality-bars">
      {heights.map((h, i) => (
        <div
          key={i}
          className="quality-bar"
          style={{
            height: `${h * 2}px`,
            background: i < bars ? color : 'var(--text-muted)',
          }}
        />
      ))}
    </div>
  )
}
