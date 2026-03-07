import { useState, useEffect } from 'react'
import { Select } from '../ui/Select'
import { getMediaManager } from '../../services/MediaManager'
import './DeviceSelector.css'

interface DeviceSelectorProps {
  kind: 'camera' | 'microphone' | 'speaker'
  value: string
  onChange: (deviceId: string) => void
}

export function DeviceSelector({ kind, value, onChange }: DeviceSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    getMediaManager().getDevices().then((d) => {
      switch (kind) {
        case 'camera': setDevices(d.cameras); break
        case 'microphone': setDevices(d.microphones); break
        case 'speaker': setDevices(d.speakers); break
      }
    })
  }, [kind])

  const label = kind === 'camera' ? 'Camera' : kind === 'microphone' ? 'Microphone' : 'Speaker'

  const options = devices.map((d) => ({
    value: d.deviceId,
    label: d.label || `${label} ${d.deviceId.slice(0, 8)}`,
  }))

  if (options.length === 0) {
    options.push({ value: '', label: `No ${label.toLowerCase()}s detected` })
  }

  return (
    <div className="device-selector">
      <Select
        label={label}
        options={options}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}
