import { useRef } from 'react'
import { useEmojiStore } from '../../store/emoji-store'
import { useClickOutside } from '../../hooks/useClickOutside'
import './CustomEmojiPicker.css'

interface CustomEmojiPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (shortcode: string) => void
}

export function CustomEmojiPicker({ isOpen, onClose, onSelect }: CustomEmojiPickerProps) {
  const emojis = useEmojiStore((s) => s.emojis)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, onClose, isOpen)

  if (!isOpen) return null

  return (
    <div ref={ref} className="custom-emoji-picker">
      {emojis.length === 0 ? (
        <div className="custom-emoji-picker-empty">
          No custom emojis. Add some in Settings.
        </div>
      ) : (
        <div className="custom-emoji-picker-grid">
          {emojis.map((emoji) => (
            <button
              key={emoji.id}
              className="custom-emoji-picker-item"
              onClick={() => onSelect(`:${emoji.shortcode}:`)}
              title={`:${emoji.shortcode}:`}
            >
              <img src={emoji.dataUrl} alt={emoji.shortcode} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
