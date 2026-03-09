import { useState } from 'react'
import { Modal, ModalFooter } from '../ui/Modal'
import { Tabs, TabList, Tab, TabPanel } from '../ui/Tabs'
import { NeonButton } from '../ui/NeonButton'
import { TextArea } from '../ui/TextArea'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { toast } from '../../store/toast-store'
import { getConnectionManager } from '../../services/ConnectionManager'
import type { ManualConnectionData } from '../../types/peer'
import './PeerInvite.css'

function validateConnectionData(data: unknown): data is ManualConnectionData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (typeof d.sdp !== 'string' || d.sdp.length === 0 || d.sdp.length > 65536) return false
  if (!Array.isArray(d.iceCandidates)) return false
  if (typeof d.peerId !== 'string' || d.peerId.length === 0 || d.peerId.length > 64) return false
  return true
}

interface PeerInviteProps {
  isOpen: boolean
  onClose: () => void
}

export function PeerInvite({ isOpen, onClose }: PeerInviteProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect to Peer" size="large">
      <Tabs defaultTab="create">
        <TabList>
          <Tab id="create">Create Invite</Tab>
          <Tab id="accept">Accept Invite</Tab>
        </TabList>
        <TabPanel id="create">
          <CreateInviteTab onClose={onClose} />
        </TabPanel>
        <TabPanel id="accept">
          <AcceptInviteTab onClose={onClose} />
        </TabPanel>
      </Tabs>
    </Modal>
  )
}

function CreateInviteTab({ onClose }: { onClose: () => void }) {
  const [offerData, setOfferData] = useState<string>('')
  const [answerInput, setAnswerInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'generate' | 'waiting' | 'done'>('generate')
  const [tempId, setTempId] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const cm = getConnectionManager()
      const data = await cm.createOffer()
      const encoded = btoa(JSON.stringify(data))
      setOfferData(encoded)
      // Get the temp connection ID
      const ids = cm.getTemporaryConnectionIds()
      setTempId(ids[ids.length - 1] || '')
      setStep('waiting')
      toast.success('Invite created! Share the code below.')
    } catch (err) {
      toast.error('Failed to create invite: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptAnswer = async () => {
    if (!answerInput.trim()) return
    setLoading(true)
    try {
      const decoded = JSON.parse(atob(answerInput.trim()))
      if (!validateConnectionData(decoded)) {
        throw new Error('Invalid connection data structure')
      }
      await getConnectionManager().handleIncomingAnswer(tempId, decoded)
      toast.success('Connection established!')
      setStep('done')
      setTimeout(onClose, 1000)
    } catch (err) {
      toast.error('Invalid answer data: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(offerData)
      toast.info('Copied to clipboard')
    } catch {
      // Fallback: select the text
      toast.warning('Could not copy — please select and copy manually')
    }
  }

  if (step === 'generate') {
    return (
      <div className="peer-invite-step">
        <p className="peer-invite-description">
          Generate an invite code and share it with the peer you want to connect to.
        </p>
        <ModalFooter>
          <NeonButton onClick={handleGenerate} disabled={loading}>
            {loading ? <LoadingSpinner size="small" /> : 'Generate Invite'}
          </NeonButton>
        </ModalFooter>
      </div>
    )
  }

  if (step === 'waiting') {
    return (
      <div className="peer-invite-step">
        <p className="peer-invite-description">
          Share this invite code with your peer. Then paste their response below.
        </p>
        <div className="peer-invite-code-section">
          <label className="peer-invite-label">Your Invite Code</label>
          <TextArea
            value={offerData}
            readOnly
            rows={4}
            className="peer-invite-code"
          />
          <NeonButton variant="secondary" size="small" onClick={handleCopy}>
            Copy
          </NeonButton>
        </div>
        <div className="peer-invite-code-section">
          <label className="peer-invite-label">Paste Response</label>
          <TextArea
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            placeholder="Paste the response code here..."
            rows={4}
          />
        </div>
        <ModalFooter>
          <NeonButton onClick={handleAcceptAnswer} disabled={loading || !answerInput.trim()}>
            {loading ? <LoadingSpinner size="small" /> : 'Connect'}
          </NeonButton>
        </ModalFooter>
      </div>
    )
  }

  return (
    <div className="peer-invite-step peer-invite-done">
      <p className="text-green">Connected successfully!</p>
    </div>
  )
}

function AcceptInviteTab({ onClose }: { onClose: () => void }) {
  const [offerInput, setOfferInput] = useState('')
  const [answerData, setAnswerData] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'paste' | 'share' | 'done'>('paste')

  const handleAccept = async () => {
    if (!offerInput.trim()) return
    setLoading(true)
    try {
      const decoded = JSON.parse(atob(offerInput.trim()))
      if (!validateConnectionData(decoded)) {
        throw new Error('Invalid connection data structure')
      }
      const response = await getConnectionManager().handleIncomingOffer(decoded)
      const encoded = btoa(JSON.stringify(response))
      setAnswerData(encoded)
      setStep('share')
      toast.success('Response generated! Share it back with the inviter.')
    } catch (err) {
      toast.error('Invalid invite code: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answerData)
      toast.info('Copied to clipboard')
    } catch {
      toast.warning('Could not copy — please select and copy manually')
    }
  }

  if (step === 'paste') {
    return (
      <div className="peer-invite-step">
        <p className="peer-invite-description">
          Paste the invite code you received from the other peer.
        </p>
        <TextArea
          value={offerInput}
          onChange={(e) => setOfferInput(e.target.value)}
          placeholder="Paste invite code here..."
          rows={4}
        />
        <ModalFooter>
          <NeonButton onClick={handleAccept} disabled={loading || !offerInput.trim()}>
            {loading ? <LoadingSpinner size="small" /> : 'Accept Invite'}
          </NeonButton>
        </ModalFooter>
      </div>
    )
  }

  if (step === 'share') {
    return (
      <div className="peer-invite-step">
        <p className="peer-invite-description">
          Share this response code back with the inviter.
        </p>
        <div className="peer-invite-code-section">
          <label className="peer-invite-label">Your Response Code</label>
          <TextArea
            value={answerData}
            readOnly
            rows={4}
            className="peer-invite-code"
          />
          <NeonButton variant="secondary" size="small" onClick={handleCopy}>
            Copy
          </NeonButton>
        </div>
        <ModalFooter>
          <NeonButton variant="secondary" onClick={onClose}>
            Done
          </NeonButton>
        </ModalFooter>
      </div>
    )
  }

  return (
    <div className="peer-invite-step peer-invite-done">
      <p className="text-green">Connected successfully!</p>
    </div>
  )
}
