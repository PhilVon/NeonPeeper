import { useState, useEffect } from 'react'
import { NeonButton } from '../ui/NeonButton'
import { getCryptoManager } from '../../services/CryptoManager'
import { usePeerStore } from '../../store/peer-store'
import './PeerVerifyDialog.css'

interface PeerVerifyDialogProps {
  peerId: string
  isOpen: boolean
  onClose: () => void
}

export function PeerVerifyDialog({ peerId, isOpen, onClose }: PeerVerifyDialogProps) {
  const [safetyNumber, setSafetyNumber] = useState<string | null>(null)
  const [verified, setVerified] = useState(false)
  const peer = usePeerStore((s) => s.peers.get(peerId))

  useEffect(() => {
    if (!isOpen || !peer?.publicKey) return
    setSafetyNumber(null)
    setVerified(getCryptoManager().isVerified(peerId))

    getCryptoManager()
      .generateSafetyNumber(peer.publicKey)
      .then(setSafetyNumber)
      .catch(() => setSafetyNumber('Error generating safety number'))
  }, [isOpen, peerId, peer?.publicKey])

  if (!isOpen) return null

  const groups = safetyNumber ? safetyNumber.split(' ') : []

  const handleVerify = () => {
    getCryptoManager().markPeerVerified(peerId)
    setVerified(true)
  }

  return (
    <div className="peer-verify-overlay" onClick={onClose}>
      <div className="peer-verify-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="peer-verify-title">Verify Identity</h3>
        <p className="peer-verify-subtitle">
          Compare these numbers with {peer?.displayName ?? 'peer'} using a trusted channel (in person, phone call, etc.)
        </p>
        {safetyNumber === null ? (
          <div className="peer-verify-loading">Generating safety numbers...</div>
        ) : (
          <div className="peer-verify-numbers">
            {groups.map((group, i) => (
              <span key={i} className="peer-verify-group">{group}</span>
            ))}
          </div>
        )}
        <div className="peer-verify-actions">
          <NeonButton size="small" variant="secondary" onClick={onClose}>
            Close
          </NeonButton>
          {!verified && safetyNumber && (
            <NeonButton size="small" onClick={handleVerify}>
              Mark as Verified
            </NeonButton>
          )}
          {verified && (
            <NeonButton size="small" variant="secondary" disabled>
              Verified
            </NeonButton>
          )}
        </div>
      </div>
    </div>
  )
}
