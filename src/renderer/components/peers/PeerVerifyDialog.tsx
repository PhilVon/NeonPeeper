import { useState, useEffect } from 'react'
import { NeonButton } from '../ui/NeonButton'
import { getCryptoManager } from '../../services/CryptoManager'
import { getConnectionManager } from '../../services/ConnectionManager'
import { useConnectionStore } from '../../store/connection-store'
import { usePeerStore } from '../../store/peer-store'
import { createMessage } from '../../types/protocol'
import './PeerVerifyDialog.css'

interface PeerVerifyDialogProps {
  peerId: string
  isOpen: boolean
  onClose: () => void
}

export function PeerVerifyDialog({ peerId, isOpen, onClose }: PeerVerifyDialogProps) {
  const [verificationCode, setVerificationCode] = useState<string | null>(null)
  const [locallyVerified, setLocallyVerified] = useState(false)
  const peer = usePeerStore((s) => s.peers.get(peerId))
  const connState = useConnectionStore((s) => s.connections.get(peerId)?.connectionState)
  const isMutual = connState === 'verified'

  useEffect(() => {
    if (!isOpen || !peer?.publicKey) return
    setVerificationCode(null)
    setLocallyVerified(getCryptoManager().isVerified(peerId))

    getCryptoManager()
      .generateSafetyNumber(peer.publicKey)
      .then(setVerificationCode)
      .catch(() => setVerificationCode('Error generating code'))
  }, [isOpen, peerId, peer?.publicKey])

  if (!isOpen) return null

  // Split XXXX-XXXX into two groups
  const groups = verificationCode ? verificationCode.split('-') : []

  const handleVerify = () => {
    const crypto = getCryptoManager()
    const cm = getConnectionManager()

    // Mark locally verified
    crypto.markPeerVerified(peerId)
    setLocallyVerified(true)

    // Send VERIFY_CONFIRM to remote peer
    const localProfile = usePeerStore.getState().localProfile
    if (localProfile) {
      const msg = createMessage('VERIFY_CONFIRM', localProfile.id, peerId, { verified: true })
      cm.sendMessage(peerId, msg)

      // If now mutually verified, send PROFILE_REVEAL and set verified state
      if (crypto.isMutuallyVerified(peerId)) {
        useConnectionStore.getState().setConnectionState(peerId, 'verified')
        cm.sendProfileReveal(peerId)
      }
    }
  }

  return (
    <div className="peer-verify-overlay" onClick={onClose}>
      <div className="peer-verify-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="peer-verify-title">Verify Identity</h3>
        <p className="peer-verify-subtitle">
          Compare this code with {peer?.displayName || 'the peer'} using a trusted channel (in person, phone call, etc.)
        </p>
        {verificationCode === null ? (
          <div className="peer-verify-loading">Generating verification code...</div>
        ) : (
          <div className="peer-verify-numbers">
            {groups.map((group, i) => (
              <span key={i} className="peer-verify-group">{group}</span>
            ))}
          </div>
        )}
        {locallyVerified && !isMutual && (
          <div className="peer-verify-status">Awaiting remote verification...</div>
        )}
        <div className="peer-verify-actions">
          <NeonButton size="small" variant="secondary" onClick={onClose}>
            Close
          </NeonButton>
          {!locallyVerified && verificationCode && (
            <NeonButton size="small" onClick={handleVerify}>
              Mark as Verified
            </NeonButton>
          )}
          {locallyVerified && (
            <NeonButton size="small" variant="secondary" disabled>
              {isMutual ? 'Mutually Verified' : 'Verified (local)'}
            </NeonButton>
          )}
        </div>
      </div>
    </div>
  )
}
