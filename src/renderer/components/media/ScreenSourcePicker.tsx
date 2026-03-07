import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Tabs, TabList, Tab, TabPanel } from '../ui/Tabs'
import type { DesktopSource } from '../../../types/electron'
import './ScreenSourcePicker.css'

interface ScreenSourcePickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (sourceId: string) => void
}

export function ScreenSourcePicker({ isOpen, onClose, onSelect }: ScreenSourcePickerProps) {
  const [sources, setSources] = useState<DesktopSource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    window.electronAPI
      .getDesktopSources()
      .then((s) => {
        setSources(s)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [isOpen])

  const screens = sources.filter((s) => s.id.startsWith('screen:'))
  const windows = sources.filter((s) => s.id.startsWith('window:'))

  const handleSelect = (sourceId: string) => {
    onSelect(sourceId)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Your Screen" size="large">
      {loading ? (
        <p className="text-muted">Loading sources...</p>
      ) : (
        <Tabs defaultTab="screens">
          <TabList>
            <Tab id="screens">Screens ({screens.length})</Tab>
            <Tab id="windows">Windows ({windows.length})</Tab>
          </TabList>
          <TabPanel id="screens">
            <div className="screen-source-grid">
              {screens.map((source) => (
                <button
                  key={source.id}
                  className="screen-source-item"
                  onClick={() => handleSelect(source.id)}
                >
                  <img src={source.thumbnail} alt={source.name} className="screen-source-thumbnail" />
                  <span className="screen-source-name">{source.name}</span>
                </button>
              ))}
            </div>
          </TabPanel>
          <TabPanel id="windows">
            <div className="screen-source-grid">
              {windows.map((source) => (
                <button
                  key={source.id}
                  className="screen-source-item"
                  onClick={() => handleSelect(source.id)}
                >
                  <img src={source.thumbnail} alt={source.name} className="screen-source-thumbnail" />
                  <span className="screen-source-name">
                    {source.appIcon && (
                      <img src={source.appIcon} alt="" className="screen-source-icon" />
                    )}
                    {source.name}
                  </span>
                </button>
              ))}
            </div>
          </TabPanel>
        </Tabs>
      )}
    </Modal>
  )
}
