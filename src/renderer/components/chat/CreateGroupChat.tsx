import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Modal, ModalFooter } from '../ui/Modal'
import { NeonButton } from '../ui/NeonButton'
import { NeonInput } from '../ui/NeonInput'
import { Checkbox } from '../ui/Checkbox'
import { Avatar } from '../ui/Avatar'
import { usePeerStore } from '../../store/peer-store'
import { useChatStore } from '../../store/chat-store'
import { useConnectionStore } from '../../store/connection-store'
import { getConnectionManager } from '../../services/ConnectionManager'
import { getSignalingClient } from '../../services/SignalingClient'
import { getPersistenceManager } from '../../services/PersistenceManager'
import { createMessage } from '../../types/protocol'
import './CreateGroupChat.css'

interface CreateGroupChatProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (chatId: string) => void
}

export function CreateGroupChat({ isOpen, onClose, onCreated }: CreateGroupChatProps) {
  const [groupName, setGroupName] = useState('')
  const [selectedPeers, setSelectedPeers] = useState<Set<string>>(new Set())
  const peers = usePeerStore((s) => s.peers)
  const connections = useConnectionStore((s) => s.connections)

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setGroupName('')
      setSelectedPeers(new Set())
    }
  }, [isOpen])

  // Filter to only connected peers
  const connectedPeers = Array.from(peers.values()).filter((peer) => {
    const conn = connections.get(peer.id)
    const cs = conn?.connectionState
    return cs === 'connected' || cs === 'verified'
  })

  const togglePeer = (peerId: string) => {
    setSelectedPeers((prev) => {
      const next = new Set(prev)
      if (next.has(peerId)) {
        next.delete(peerId)
      } else {
        next.add(peerId)
      }
      return next
    })
  }

  const handleCreate = () => {
    const localId = usePeerStore.getState().localProfile?.id
    if (!localId) return

    const chatId = `group:${uuidv4()}`
    const members = [localId, ...selectedPeers]
    const name = groupName.trim() || null
    const now = Date.now()

    // Create chat in store
    useChatStore.getState().upsertChat({
      id: chatId,
      type: 'group',
      name,
      members: [...members],
      state: 'active',
      lastActivity: now,
      lastMessageId: null,
      lastMessagePreview: null,
      unreadCount: 0,
      createdAt: now,
    })

    // Persist to IndexedDB
    getPersistenceManager().storeChat({
      id: chatId,
      type: 'group',
      name,
      members: [...members],
      state: 'active',
      lastActivity: now,
      lastMessageId: null,
      unreadCount: 0,
      createdAt: now,
    }).catch(() => {})

    // Notify all selected peers
    const cm = getConnectionManager()
    for (const peerId of selectedPeers) {
      const msg = createMessage('CHAT_CREATE', localId, peerId, {
        chatId,
        type: 'group',
        name: name ?? undefined,
        members: [...members],
      }, chatId)
      cm.sendMessage(peerId, msg)
    }

    // Join signaling room for group discovery
    const sc = getSignalingClient()
    if (sc.getState() === 'connected') sc.joinRoom(chatId)

    onCreated(chatId)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Group Chat" size="medium">
      <div className="create-group-chat-form">
        <NeonInput
          label="Group Name (optional)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Enter group name..."
        />

        <div>
          <div className="create-group-chat-label">Select Peers</div>
          <div className="create-group-chat-peers">
            {connectedPeers.length === 0 && (
              <div className="create-group-chat-empty">
                No connected peers available. Connect to peers first.
              </div>
            )}
            {connectedPeers.map((peer) => {
              const isSelected = selectedPeers.has(peer.id)
              const classes = [
                'create-group-chat-peer',
                isSelected ? 'create-group-chat-peer-selected' : '',
              ].filter(Boolean).join(' ')

              return (
                <div
                  key={peer.id}
                  className={classes}
                  onClick={() => togglePeer(peer.id)}
                >
                  <Checkbox
                    checked={isSelected}
                    onChange={() => togglePeer(peer.id)}
                    size="small"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Avatar name={peer.displayName} size="small" status="online" />
                  <span className="create-group-chat-peer-name">
                    {peer.displayName}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <ModalFooter>
          <NeonButton variant="secondary" onClick={onClose}>Cancel</NeonButton>
          <NeonButton
            disabled={selectedPeers.size === 0}
            onClick={handleCreate}
          >
            Create
          </NeonButton>
        </ModalFooter>
      </div>
    </Modal>
  )
}
