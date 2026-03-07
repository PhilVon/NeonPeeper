import { useState, useRef, useCallback, useEffect } from 'react'
import { GiphyFetch } from '@giphy/js-fetch-api'
import { Grid } from '@giphy/react-components'
import type { IGif } from '@giphy/js-types'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useSettingsStore } from '../../store/settings-store'
import { Portal } from '../utils/Portal'
import type { GifMeta } from '../../types/protocol'
import './GiphySearchPanel.css'

interface GiphySearchPanelProps {
  isOpen: boolean
  onClose: () => void
  onSelectGif: (url: string, meta: GifMeta) => void
}

export function GiphySearchPanel({ isOpen, onClose, onSelectGif }: GiphySearchPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const giphyApiKey = useSettingsStore((s) => s.giphyApiKey)

  useClickOutside(containerRef, onClose, isOpen)
  useEscapeKey(onClose, isOpen)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset search on close
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('')
      setDebouncedTerm('')
    }
  }, [isOpen])

  const handleGifClick = useCallback((gif: IGif, e: React.SyntheticEvent) => {
    e.preventDefault()
    const url = gif.images.fixed_height.url
    const preview = gif.images.fixed_height_small?.url || url
    onSelectGif(url, {
      gifUrl: url,
      gifPreviewUrl: preview,
      gifWidth: gif.images.fixed_height.width as number,
      gifHeight: gif.images.fixed_height.height as number,
      gifTitle: gif.title || '',
    })
    onClose()
  }, [onSelectGif, onClose])

  if (!isOpen) return null

  if (!giphyApiKey) {
    return (
      <Portal>
        <div className="giphy-panel-overlay">
          <div ref={containerRef} className="giphy-panel">
            <div className="giphy-panel-no-key">
              <p>Giphy API key required</p>
              <p>
                Get a free key at{' '}
                <a href="https://developers.giphy.com" target="_blank" rel="noopener noreferrer">
                  developers.giphy.com
                </a>
              </p>
              <p>Add it in Settings &gt; Profile &gt; Integrations</p>
            </div>
          </div>
        </div>
      </Portal>
    )
  }

  const gf = new GiphyFetch(giphyApiKey)

  const fetchGifs = (offset: number) => {
    if (debouncedTerm) {
      return gf.search(debouncedTerm, { offset, limit: 10 })
    }
    return gf.trending({ offset, limit: 10 })
  }

  return (
    <Portal>
      <div className="giphy-panel-overlay">
        <div ref={containerRef} className="giphy-panel">
          <div className="giphy-panel-header">
            <input
              className="giphy-panel-search"
              type="text"
              placeholder="Search GIFs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <div className="giphy-panel-grid">
            <Grid
              key={debouncedTerm}
              width={344}
              columns={2}
              gutter={6}
              fetchGifs={fetchGifs}
              onGifClick={handleGifClick}
              noLink
            />
          </div>
          <div className="giphy-panel-footer">
            <span className="giphy-panel-attribution">Powered by GIPHY</span>
          </div>
        </div>
      </div>
    </Portal>
  )
}
