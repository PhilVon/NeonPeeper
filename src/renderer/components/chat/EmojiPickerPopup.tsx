import { useRef } from 'react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { useClickOutside } from '../../hooks/useClickOutside'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { Portal } from '../utils/Portal'
import './EmojiPickerPopup.css'

interface EmojiPickerPopupProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (emoji: string) => void
}

export function EmojiPickerPopup({ isOpen, onClose, onSelect }: EmojiPickerPopupProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, onClose, isOpen)
  useEscapeKey(onClose, isOpen)

  if (!isOpen) return null

  return (
    <Portal>
      <div className="emoji-picker-overlay">
        <div ref={containerRef} className="emoji-picker-container">
          <Picker
            data={data}
            onEmojiSelect={(emoji: { native: string }) => onSelect(emoji.native)}
            theme="dark"
            previewPosition="none"
            skinTonePosition="search"
            maxFrequentRows={2}
          />
        </div>
      </div>
    </Portal>
  )
}
