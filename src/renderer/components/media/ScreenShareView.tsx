import { useEffect, useRef } from 'react'
import './ScreenShareView.css'

interface ScreenShareViewProps {
  stream: MediaStream
  isLocal?: boolean
}

export function ScreenShareView({ stream, isLocal = false }: ScreenShareViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className="screen-share-view">
      {isLocal && (
        <div className="screen-share-banner">
          You are sharing your screen
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="screen-share-video"
      />
    </div>
  )
}
