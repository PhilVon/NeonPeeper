import { RadioGroup, Radio } from '../ui/Radio'
import { useSettingsStore } from '../../store/settings-store'
import './QualitySettings.css'

export function QualitySettings() {
  const qualityPreset = useSettingsStore((s) => s.qualityPreset)
  const setQualityPreset = useSettingsStore((s) => s.setQualityPreset)
  const preferredCodec = useSettingsStore((s) => s.preferredCodec)
  const setPreferredCodec = useSettingsStore((s) => s.setPreferredCodec)

  return (
    <div className="quality-settings">
      <h3>Video Quality</h3>
      <RadioGroup
        name="quality-preset"
        value={qualityPreset}
        onChange={(v) => setQualityPreset(v as typeof qualityPreset)}
      >
        <Radio value="low" label="Low (320x240, 15fps)" />
        <Radio value="medium" label="Medium (640x480, 24fps)" />
        <Radio value="high" label="High (1280x720, 30fps)" />
        <Radio value="ultra" label="Ultra (1920x1080, 30fps)" />
        <Radio value="adaptive" label="Adaptive (auto)" />
      </RadioGroup>

      <h3>Preferred Codec</h3>
      <RadioGroup
        name="codec-preference"
        value={preferredCodec}
        onChange={(v) => setPreferredCodec(v as typeof preferredCodec)}
      >
        <Radio value="auto" label="Auto" />
        <Radio value="h264" label="H.264 (best hardware support)" />
        <Radio value="vp8" label="VP8 (universal fallback)" />
        <Radio value="vp9" label="VP9 (best for screen sharing)" />
      </RadioGroup>
    </div>
  )
}
