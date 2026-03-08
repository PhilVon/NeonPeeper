import { Modal } from '../ui/Modal'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { StatusIndicator } from '../ui/StatusIndicator'
import { useConnectionStore } from '../../store/connection-store'
import type { ConnectionState } from '../../types/peer'
import './ConnectionDialog.css'

interface ConnectionDialogProps {
  isOpen: boolean
  onClose: () => void
  peerId: string
}

const STAGES: { state: ConnectionState; label: string }[] = [
  { state: 'signaling', label: 'Signaling' },
  { state: 'ice-checking', label: 'ICE Checking' },
  { state: 'dtls-handshake', label: 'DTLS Handshake' },
  { state: 'handshake', label: 'Protocol Handshake' },
  { state: 'connected', label: 'Connected' },
  { state: 'verified', label: 'Verified' },
]

function getStageIndex(state: ConnectionState): number {
  const idx = STAGES.findIndex((s) => s.state === state)
  if (state === 'connecting') return 0
  if (state === 'failed' || state === 'disconnected') return -1
  return idx
}

function getStageStatus(stageIdx: number, currentIdx: number, failed: boolean): 'online' | 'offline' | 'busy' | 'idle' {
  if (failed) return 'offline'
  if (stageIdx < currentIdx) return 'online'
  if (stageIdx === currentIdx) return 'busy'
  return 'idle'
}

export function ConnectionDialog({ isOpen, onClose, peerId }: ConnectionDialogProps) {
  const connection = useConnectionStore((s) => s.connections.get(peerId))
  const currentState = connection?.connectionState ?? 'disconnected'
  const currentIdx = getStageIndex(currentState)
  const isFailed = currentState === 'failed'
  const isConnected = currentState === 'connected' || currentState === 'verified'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connecting..." size="small">
      <div className="connection-dialog">
        <div className="connection-dialog-stages">
          {STAGES.map((stage, idx) => {
            const status = getStageStatus(idx, currentIdx, isFailed)
            const isActive = idx === currentIdx && !isFailed && !isConnected
            return (
              <div
                key={stage.state}
                className={[
                  'connection-dialog-stage',
                  isActive && 'connection-dialog-stage-active',
                  status === 'online' && 'connection-dialog-stage-complete',
                ].filter(Boolean).join(' ')}
              >
                <StatusIndicator status={status} size="small" pulse={isActive} />
                <span className="connection-dialog-stage-label">{stage.label}</span>
                {isActive && <LoadingSpinner size="small" color="cyan" />}
              </div>
            )
          })}
        </div>
        {isFailed && (
          <div className="connection-dialog-error">
            Connection failed. Please try again.
          </div>
        )}
        {isConnected && (
          <div className="connection-dialog-success">
            Connected!
          </div>
        )}
        {connection?.rttMs != null && (
          <div className="connection-dialog-rtt">
            RTT: {connection.rttMs}ms
          </div>
        )}
      </div>
    </Modal>
  )
}
