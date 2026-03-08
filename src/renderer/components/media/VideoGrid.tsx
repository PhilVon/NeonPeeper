import { VideoTile } from './VideoTile'
import { useMediaStore } from '../../store/media-store'
import { usePeerStore } from '../../store/peer-store'
import './VideoGrid.css'

export function VideoGrid() {
  const localStream = useMediaStore((s) => s.localCameraStream)
  const remoteStreams = useMediaStore((s) => s.remoteStreams)
  const videoEnabled = useMediaStore((s) => s.videoEnabled)
  const localName = usePeerStore((s) => s.localProfile?.displayName ?? 'You')
  const peers = usePeerStore((s) => s.peers)
  const screenStream = useMediaStore((s) => s.localScreenStream)
  const remoteScreenStreams = useMediaStore((s) => s.remoteScreenStreams)

  const remoteList = Array.from(remoteStreams.values())
  const remoteScreenList = Array.from(remoteScreenStreams.values())
  const totalParticipants = 1 + remoteList.length

  const gridClass = totalParticipants <= 1
    ? 'video-grid-1'
    : totalParticipants <= 2
    ? 'video-grid-2'
    : totalParticipants <= 4
    ? 'video-grid-4'
    : totalParticipants <= 6
    ? 'video-grid-6'
    : totalParticipants <= 9
    ? 'video-grid-9'
    : 'video-grid-large'

  return (
    <div className="video-grid-container">
      {(screenStream || remoteScreenList.length > 0) && (
        <div className="video-grid-screen-share">
          {screenStream && (
            <VideoTile
              stream={screenStream}
              name="Screen Share"
              muted
            />
          )}
          {remoteScreenList.map((remote) => (
            <VideoTile
              key={`screen-${remote.peerId}`}
              stream={remote.stream}
              name={`${peers.get(remote.peerId)?.displayName ?? remote.peerId.slice(0, 8)}'s Screen`}
              muted
            />
          ))}
        </div>
      )}
      <div className={`video-grid ${gridClass}`}>
        {remoteList.map((remote) => (
          <VideoTile
            key={remote.peerId}
            stream={remote.stream}
            name={peers.get(remote.peerId)?.displayName ?? remote.peerId.slice(0, 8)}
            videoEnabled={remote.videoEnabled}
            showQuality
          />
        ))}
        <VideoTile
          stream={localStream}
          name={localName}
          muted
          mirrored
          videoEnabled={videoEnabled}
        />
      </div>
    </div>
  )
}
