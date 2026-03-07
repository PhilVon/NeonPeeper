import { useState, useEffect, useMemo } from 'react'
import { useMediaStore } from '../../store/media-store'
import { usePeerStore } from '../../store/peer-store'
import { VideoTile } from './VideoTile'
import { NeonButton } from '../ui/NeonButton'
import './ChatVideoPanel.css'

interface TileInfo {
  id: string
  stream: MediaStream | null
  name: string
  muted: boolean
  mirrored: boolean
  videoEnabled: boolean
  objectFit: 'cover' | 'contain'
}

interface ChatVideoPanelProps {
  chatId: string
  onStartSharing: () => void
  onStopSharing: () => void
  onToggleAudio: () => void
  onToggleVideo: () => void
  onToggleScreenShare: () => void
}

export function ChatVideoPanel({
  chatId,
  onStartSharing,
  onStopSharing,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
}: ChatVideoPanelProps) {
  const localStream = useMediaStore((s) => s.localCameraStream)
  const localScreenStream = useMediaStore((s) => s.localScreenStream)
  const audioMuted = useMediaStore((s) => s.audioMuted)
  const videoEnabled = useMediaStore((s) => s.videoEnabled)
  const isLocalSharing = useMediaStore((s) => s.videoSharingChatIds.has(chatId))
  const chatParticipants = useMediaStore((s) => s.chatVideoParticipants.get(chatId))
  const remoteStreams = useMediaStore((s) => s.remoteStreams)
  const remoteScreenStreams = useMediaStore((s) => s.remoteScreenStreams)
  const localName = usePeerStore((s) => s.localProfile?.displayName ?? 'You')
  const peers = usePeerStore((s) => s.peers)
  const localId = usePeerStore((s) => s.localProfile?.id)
  const screenStream = useMediaStore((s) => s.localScreenStream)

  const [focusedTileId, setFocusedTileId] = useState<string | null>(null)

  const remotePeerIds = chatParticipants
    ? Array.from(chatParticipants).filter((pid) => pid !== localId)
    : []

  // Build unified tile list
  const tiles = useMemo<TileInfo[]>(() => {
    const result: TileInfo[] = []

    // Local camera tile
    if (isLocalSharing) {
      result.push({
        id: 'local-camera',
        stream: localStream,
        name: localName,
        muted: true,
        mirrored: true,
        videoEnabled,
        objectFit: 'cover',
      })
    }

    // Local screen share tile
    if (localScreenStream) {
      result.push({
        id: 'local-screen',
        stream: localScreenStream,
        name: `${localName}'s Screen`,
        muted: true,
        mirrored: false,
        videoEnabled: true,
        objectFit: 'contain',
      })
    }

    // Remote camera tiles
    for (const peerId of remotePeerIds) {
      const rs = remoteStreams.get(peerId)
      const peerName = peers.get(peerId)?.displayName ?? peerId.slice(0, 8)
      result.push({
        id: `cam-${peerId}`,
        stream: rs?.stream ?? null,
        name: peerName,
        muted: false,
        mirrored: false,
        videoEnabled: rs?.videoEnabled ?? true,
        objectFit: 'cover',
      })
    }

    // Remote screen share tiles
    for (const peerId of remotePeerIds) {
      const rss = remoteScreenStreams.get(peerId)
      if (rss) {
        const peerName = peers.get(peerId)?.displayName ?? peerId.slice(0, 8)
        result.push({
          id: `screen-${peerId}`,
          stream: rss.stream,
          name: `${peerName}'s Screen`,
          muted: true,
          mirrored: false,
          videoEnabled: true,
          objectFit: 'contain',
        })
      }
    }

    return result
  }, [isLocalSharing, localStream, localScreenStream, localName, videoEnabled, remotePeerIds, remoteStreams, remoteScreenStreams, peers])

  // Auto-clear focused tile if it disappears
  useEffect(() => {
    if (focusedTileId && !tiles.find((t) => t.id === focusedTileId)) {
      setFocusedTileId(null)
    }
  }, [focusedTileId, tiles])

  const focusedTile = focusedTileId ? tiles.find((t) => t.id === focusedTileId) : null
  const otherTiles = focusedTileId ? tiles.filter((t) => t.id !== focusedTileId) : tiles

  return (
    <div className="chat-video-panel">
      {focusedTile ? (
        <>
          <div className="chat-video-panel-focused" onClick={() => setFocusedTileId(null)}>
            <VideoTile
              stream={focusedTile.stream}
              name={focusedTile.name}
              muted={focusedTile.muted}
              mirrored={focusedTile.mirrored}
              videoEnabled={focusedTile.videoEnabled}
              objectFit={focusedTile.objectFit}
            />
          </div>
          {otherTiles.length > 0 && (
            <div className="chat-video-panel-strip">
              {otherTiles.map((tile) => (
                <div
                  key={tile.id}
                  className="chat-video-panel-strip-item"
                  onClick={() => setFocusedTileId(tile.id)}
                >
                  <VideoTile
                    stream={tile.stream}
                    name={tile.name}
                    muted={tile.muted}
                    mirrored={tile.mirrored}
                    videoEnabled={tile.videoEnabled}
                    objectFit={tile.objectFit}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="chat-video-panel-tiles">
          {tiles.map((tile) => (
            <div
              key={tile.id}
              className="chat-video-panel-tile-wrapper"
              onClick={() => tiles.length > 1 && setFocusedTileId(tile.id)}
            >
              <VideoTile
                stream={tile.stream}
                name={tile.name}
                muted={tile.muted}
                mirrored={tile.mirrored}
                videoEnabled={tile.videoEnabled}
                objectFit={tile.objectFit}
              />
            </div>
          ))}
        </div>
      )}

      {isLocalSharing ? (
        <div className="chat-video-panel-controls">
          <NeonButton
            variant={audioMuted ? 'danger' : 'secondary'}
            size="small"
            onClick={onToggleAudio}
            title={audioMuted ? 'Unmute' : 'Mute'}
          >
            {audioMuted ? 'Unmute' : 'Mute'}
          </NeonButton>
          <NeonButton
            variant={videoEnabled ? 'secondary' : 'danger'}
            size="small"
            onClick={onToggleVideo}
            title={videoEnabled ? 'Cam off' : 'Cam on'}
          >
            {videoEnabled ? 'Cam On' : 'Cam Off'}
          </NeonButton>
          <NeonButton
            variant={screenStream ? 'primary' : 'secondary'}
            size="small"
            onClick={onToggleScreenShare}
            title="Screen share"
          >
            {screenStream ? 'Stop Share' : 'Share'}
          </NeonButton>
          <NeonButton variant="danger" size="small" onClick={onStopSharing}>
            Leave
          </NeonButton>
        </div>
      ) : (
        <div className="chat-video-panel-invite">
          <NeonButton variant="primary" size="small" onClick={onStartSharing}>
            Share Your Video
          </NeonButton>
        </div>
      )}
    </div>
  )
}
