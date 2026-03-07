import { useEffect, useRef, useState } from 'react'
import { DeviceSelector } from '../media/DeviceSelector'
import { useSettingsStore } from '../../store/settings-store'
import './MediaSettings.css'

export function MediaSettings() {
  const cameraDeviceId = useSettingsStore((s) => s.cameraDeviceId)
  const micDeviceId = useSettingsStore((s) => s.micDeviceId)
  const speakerDeviceId = useSettingsStore((s) => s.speakerDeviceId)
  const setCameraDeviceId = useSettingsStore((s) => s.setCameraDeviceId)
  const setMicDeviceId = useSettingsStore((s) => s.setMicDeviceId)
  const setSpeakerDeviceId = useSettingsStore((s) => s.setSpeakerDeviceId)

  const videoRef = useRef<HTMLVideoElement>(null)
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    // Start camera preview
    navigator.mediaDevices
      .getUserMedia({
        video: cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : true,
        audio: false,
      })
      .then((stream) => {
        setPreviewStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch(() => {})

    return () => {
      previewStream?.getTracks().forEach((t) => t.stop())
    }
  }, [cameraDeviceId])

  return (
    <div className="media-settings">
      <h3>Media Devices</h3>
      <div className="media-settings-preview">
        <video ref={videoRef} autoPlay playsInline muted className="media-settings-video" />
      </div>
      <DeviceSelector kind="camera" value={cameraDeviceId} onChange={setCameraDeviceId} />
      <DeviceSelector kind="microphone" value={micDeviceId} onChange={setMicDeviceId} />
      <DeviceSelector kind="speaker" value={speakerDeviceId} onChange={setSpeakerDeviceId} />
    </div>
  )
}
