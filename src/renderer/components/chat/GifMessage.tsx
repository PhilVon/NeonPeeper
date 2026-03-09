import { useState } from 'react'
import type { GifMeta } from '../../types/protocol'
import './GifMessage.css'

interface GifMessageProps {
  url: string
  meta?: GifMeta
}

function isValidGifUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function GifMessage({ url, meta }: GifMessageProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (error || !isValidGifUrl(url)) {
    return <span className="gif-message-error">Invalid GIF URL</span>
  }

  return (
    <div className="gif-message">
      {!loaded && <div className="gif-message-loading" />}
      <img
        src={url}
        alt={meta?.gifTitle || 'GIF'}
        width={meta?.gifWidth}
        height={meta?.gifHeight}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={loaded ? undefined : { position: 'absolute', opacity: 0 }}
        referrerPolicy="no-referrer"
      />
    </div>
  )
}
