import { Select } from '../ui/Select'
import { useSettingsStore } from '../../store/settings-store'
import './PrivacySettings.css'

const TTL_OPTIONS = [
  { value: '0', label: 'Never' },
  { value: '30000', label: '30 seconds' },
  { value: '300000', label: '5 minutes' },
  { value: '3600000', label: '1 hour' },
  { value: '86400000', label: '24 hours' },
  { value: '604800000', label: '7 days' },
]

export function PrivacySettings() {
  const messageAutoDeleteTtl = useSettingsStore((s) => s.messageAutoDeleteTtl)
  const setMessageAutoDeleteTtl = useSettingsStore((s) => s.setMessageAutoDeleteTtl)

  return (
    <div className="privacy-settings">
      <h3>Privacy</h3>

      <Select
        label="Auto-delete sent messages"
        options={TTL_OPTIONS}
        value={String(messageAutoDeleteTtl)}
        onChange={(value) => setMessageAutoDeleteTtl(Number(value))}
      />
      <p className="privacy-settings-hint">
        Messages you send will be automatically deleted for both you and the recipient after the selected duration.
        This only affects new messages — existing messages are not changed.
      </p>
    </div>
  )
}
