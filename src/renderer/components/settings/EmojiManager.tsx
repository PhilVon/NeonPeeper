import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useEmojiStore } from '../../store/emoji-store'
import { NeonButton } from '../ui/NeonButton'
import { NeonInput } from '../ui/NeonInput'
import { ImageEditor } from '../ui/ImageEditor'
import { Modal, ModalFooter } from '../ui/Modal'
import { toast } from '../../store/toast-store'
import './EmojiManager.css'

const SHORTCODE_REGEX = /^[a-zA-Z0-9_]{2,32}$/

export function EmojiManager() {
  const emojis = useEmojiStore((s) => s.emojis)
  const addEmoji = useEmojiStore((s) => s.addEmoji)
  const removeEmoji = useEmojiStore((s) => s.removeEmoji)
  const updateEmojiShortcode = useEmojiStore((s) => s.updateEmojiShortcode)

  const [showEditor, setShowEditor] = useState(false)
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null)
  const [showShortcodeModal, setShowShortcodeModal] = useState(false)
  const [shortcodeInput, setShortcodeInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingShortcode, setEditingShortcode] = useState('')

  const handleImageSave = (dataUrl: string) => {
    setPendingDataUrl(dataUrl)
    setShortcodeInput('')
    setShowShortcodeModal(true)
  }

  const handleConfirmShortcode = async () => {
    if (!pendingDataUrl) return
    const code = shortcodeInput.trim()

    if (!SHORTCODE_REGEX.test(code)) {
      toast.error('Shortcode must be 2-32 alphanumeric/underscore characters')
      return
    }

    if (emojis.some((e) => e.shortcode === code)) {
      toast.error('Shortcode already in use')
      return
    }

    await addEmoji({
      id: uuidv4(),
      shortcode: code,
      dataUrl: pendingDataUrl,
      createdAt: Date.now(),
    })

    setPendingDataUrl(null)
    setShowShortcodeModal(false)
  }

  const handleStartEditShortcode = (id: string, currentShortcode: string) => {
    setEditingId(id)
    setEditingShortcode(currentShortcode)
  }

  const handleConfirmEditShortcode = async (id: string) => {
    const code = editingShortcode.trim()
    if (!SHORTCODE_REGEX.test(code)) {
      toast.error('Invalid shortcode format')
      return
    }
    if (emojis.some((e) => e.shortcode === code && e.id !== id)) {
      toast.error('Shortcode already in use')
      return
    }
    await updateEmojiShortcode(id, code)
    setEditingId(null)
  }

  return (
    <div className="emoji-manager">
      <h3>Custom Emojis</h3>
      <p className="emoji-manager-count">{emojis.length} / 50</p>

      {emojis.length === 0 ? (
        <p className="emoji-manager-empty">No custom emojis yet</p>
      ) : (
        <div className="emoji-manager-grid">
          {emojis.map((emoji) => (
            <div key={emoji.id} className="emoji-manager-item">
              <img src={emoji.dataUrl} alt={emoji.shortcode} />
              {editingId === emoji.id ? (
                <input
                  className="emoji-manager-shortcode-input"
                  value={editingShortcode}
                  onChange={(e) => setEditingShortcode(e.target.value)}
                  onBlur={() => handleConfirmEditShortcode(emoji.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmEditShortcode(emoji.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="emoji-manager-shortcode"
                  onClick={() => handleStartEditShortcode(emoji.id, emoji.shortcode)}
                  title="Click to edit shortcode"
                >
                  :{emoji.shortcode}:
                </span>
              )}
              <button
                className="emoji-manager-delete"
                onClick={() => removeEmoji(emoji.id)}
                title="Delete emoji"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <NeonButton
        size="small"
        variant="secondary"
        onClick={() => setShowEditor(true)}
        disabled={emojis.length >= 50}
      >
        Add Emoji
      </NeonButton>

      <ImageEditor
        isOpen={showEditor}
        onClose={() => setShowEditor(false)}
        onSave={handleImageSave}
        mode="emoji"
        title="Create Custom Emoji"
      />

      <Modal
        isOpen={showShortcodeModal}
        onClose={() => setShowShortcodeModal(false)}
        title="Set Shortcode"
        size="small"
      >
        <NeonInput
          label="Shortcode"
          value={shortcodeInput}
          onChange={(e) => setShortcodeInput(e.target.value)}
          placeholder="e.g. cool_face"
          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmShortcode() }}
        />
        <p className="text-muted" style={{ fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-xs)' }}>
          2-32 characters: letters, numbers, underscores
        </p>
        <ModalFooter>
          <NeonButton variant="secondary" onClick={() => setShowShortcodeModal(false)}>
            Cancel
          </NeonButton>
          <NeonButton onClick={handleConfirmShortcode} disabled={!shortcodeInput.trim()}>
            Save
          </NeonButton>
        </ModalFooter>
      </Modal>
    </div>
  )
}
