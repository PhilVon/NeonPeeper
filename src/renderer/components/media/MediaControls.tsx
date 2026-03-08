import { NeonButton } from '../ui/NeonButton'
import { useMediaStore } from '../../store/media-store'
import './MediaControls.css'

interface MediaControlsProps {
  onToggleAudio: () => void
  onToggleVideo: () => void
  onToggleScreenShare?: () => void
  onEndCall: () => void
  onOpenSettings?: () => void
}

export function MediaControls({
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onEndCall,
  onOpenSettings,
}: MediaControlsProps) {
  const audioMuted = useMediaStore((s) => s.audioMuted)
  const videoEnabled = useMediaStore((s) => s.videoEnabled)
  const screenStream = useMediaStore((s) => s.localScreenStream)

  return (
    <div className="media-controls" role="toolbar" aria-label="Media controls">
      <NeonButton
        variant={audioMuted ? 'danger' : 'secondary'}
        size="medium"
        onClick={onToggleAudio}
        title={audioMuted ? 'Unmute' : 'Mute'}
        aria-label={audioMuted ? 'Unmute microphone' : 'Mute microphone'}
        aria-pressed={!audioMuted}
      >
        {audioMuted ? 'Unmute' : 'Mute'}
      </NeonButton>

      <NeonButton
        variant={videoEnabled ? 'secondary' : 'danger'}
        size="medium"
        onClick={onToggleVideo}
        title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
        aria-label={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
        aria-pressed={videoEnabled}
      >
        {videoEnabled ? 'Cam On' : 'Cam Off'}
      </NeonButton>

      <NeonButton
        variant={screenStream ? 'primary' : 'secondary'}
        size="medium"
        onClick={onToggleScreenShare}
        disabled={!onToggleScreenShare}
        title="Share screen"
        aria-label={screenStream ? 'Stop screen sharing' : 'Share screen'}
        aria-pressed={!!screenStream}
      >
        {screenStream ? 'Stop Share' : 'Share'}
      </NeonButton>

      {onOpenSettings && (
        <NeonButton
          variant="secondary"
          size="medium"
          onClick={onOpenSettings}
          title="Settings"
        >
          Settings
        </NeonButton>
      )}

      <NeonButton
        variant="danger"
        size="medium"
        onClick={onEndCall}
        title="End call"
      >
        End
      </NeonButton>
    </div>
  )
}
