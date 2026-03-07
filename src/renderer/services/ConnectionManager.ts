import { v4 as uuidv4 } from 'uuid'
import {
  createMessage,
  PROTOCOL_CONSTANTS,
  type NeonP2PMessage,
  type MessageType,
} from '../types/protocol'
import { useConnectionStore } from '../store/connection-store'
import { usePeerStore } from '../store/peer-store'
import { useSettingsStore } from '../store/settings-store'
import { getCryptoManager } from './CryptoManager'
import type { ConnectionState, ManualConnectionData } from '../types/peer'

type EventCallback = (...args: unknown[]) => void

interface PeerConnection {
  pc: RTCPeerConnection
  controlChannel: RTCDataChannel | null
  ephemeralChannel: RTCDataChannel | null
  pendingIceCandidates: RTCIceCandidateInit[]
  pingInterval: ReturnType<typeof setInterval> | null
  pingTimestamps: Map<number, number>
  peerIdRef: { current: string }
}

export class ConnectionManager {
  private connections = new Map<string, PeerConnection>()
  private eventListeners = new Map<string, Set<EventCallback>>()
  private _destroyed = false
  private userInitiatedCloses = new Set<string>()

  get localPeerId(): string {
    return usePeerStore.getState().localProfile?.id ?? ''
  }

  // --- Event emitter ---

  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(callback)
  }

  off(event: string, callback: EventCallback): void {
    this.eventListeners.get(event)?.delete(callback)
  }

  private emit(event: string, ...args: unknown[]): void {
    this.eventListeners.get(event)?.forEach((cb) => cb(...args))
  }

  // --- ICE server configuration ---

  private getIceServers(): RTCIceServer[] {
    const settings = useSettingsStore.getState()
    const servers: RTCIceServer[] = []

    if (settings.stunServers.length > 0) {
      for (const url of settings.stunServers) {
        if (url) servers.push({ urls: url })
      }
    }

    if (!servers.length) {
      servers.push({ urls: 'stun:stun.l.google.com:19302' })
    }

    if (settings.turnServer) {
      servers.push({
        urls: settings.turnServer,
        username: settings.turnUsername,
        credential: settings.turnPassword,
      })
    }

    return servers
  }

  // --- User-initiated close tracking ---

  markUserInitiated(peerId: string): void {
    this.userInitiatedCloses.add(peerId)
  }

  wasUserInitiated(peerId: string): boolean {
    return this.userInitiatedCloses.has(peerId)
  }

  clearUserInitiated(peerId: string): void {
    this.userInitiatedCloses.delete(peerId)
  }

  // --- RTCPeerConnection creation ---

  private createPeerConnection(peerIdRef: { current: string }): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: this.getIceServers() })

    pc.oniceconnectionstatechange = () => {
      useConnectionStore.getState().setIceState(peerIdRef.current, pc.iceConnectionState)
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.updateState(peerIdRef.current, 'connected')
      } else if (pc.iceConnectionState === 'failed') {
        this.updateState(peerIdRef.current, 'failed')
        this.emit('peer-disconnected', peerIdRef.current)
      } else if (pc.iceConnectionState === 'disconnected') {
        this.updateState(peerIdRef.current, 'reconnecting')
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const conn = this.connections.get(peerIdRef.current)
        if (conn) {
          conn.pendingIceCandidates.push(event.candidate.toJSON())
        }
        this.emit('ice-candidate', peerIdRef.current, event.candidate.toJSON())
      }
    }

    pc.ondatachannel = (event) => {
      const channel = event.channel
      const conn = this.connections.get(peerIdRef.current)
      if (!conn) return

      if (channel.label === 'control') {
        conn.controlChannel = channel
        this.setupControlChannel(peerIdRef, channel)
      } else if (channel.label === 'ephemeral') {
        conn.ephemeralChannel = channel
        this.setupEphemeralChannel(peerIdRef, channel)
      }
    }

    pc.onnegotiationneeded = () => {
      this.emit('negotiation-needed', peerIdRef.current)
    }

    pc.ontrack = (event) => {
      this.emit('remote-track', peerIdRef.current, event.streams, event.track)
    }

    return pc
  }

  // --- DataChannel setup ---

  private setupControlChannel(peerIdRef: { current: string }, channel: RTCDataChannel): void {
    channel.onopen = () => {
      useConnectionStore.getState().setDataChannelState(peerIdRef.current, 'open')
      // Only set 'handshake' if not already 'connected' — avoid downgrading state
      const currentState = useConnectionStore.getState().getConnection(peerIdRef.current)?.connectionState
      if (currentState !== 'connected') {
        this.updateState(peerIdRef.current, 'handshake')
      }
      this.sendHello(peerIdRef.current)
      this.startPingPong(peerIdRef.current)
    }
    channel.onclose = () => {
      useConnectionStore.getState().setDataChannelState(peerIdRef.current, 'closed')
      this.stopPingPong(peerIdRef.current)
      this.updateState(peerIdRef.current, 'disconnected')
      this.emit('peer-disconnected', peerIdRef.current)
    }
    channel.onmessage = (event) => {
      this.emit('data-channel-message', peerIdRef.current, event.data)
    }
  }

  private setupEphemeralChannel(peerIdRef: { current: string }, channel: RTCDataChannel): void {
    channel.onmessage = (event) => {
      this.emit('data-channel-message', peerIdRef.current, event.data)
    }
  }

  // --- Manual SDP flow ---

  async createOffer(): Promise<ManualConnectionData> {
    const tempId = uuidv4().replace(/-/g, '')
    const peerIdRef = { current: tempId }
    const pc = this.createPeerConnection(peerIdRef)

    const controlChannel = pc.createDataChannel('control', { ordered: true })
    const ephemeralChannel = pc.createDataChannel('ephemeral', {
      ordered: false,
      maxRetransmits: 0,
    })

    const conn: PeerConnection = {
      pc,
      controlChannel,
      ephemeralChannel,
      pendingIceCandidates: [],
      pingInterval: null,
      pingTimestamps: new Map(),
      peerIdRef,
    }
    this.connections.set(tempId, conn)

    this.setupControlChannel(peerIdRef, controlChannel)
    this.setupEphemeralChannel(peerIdRef, ephemeralChannel)

    this.updateState(tempId, 'connecting')

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    // Wait for ICE gathering to complete
    await this.waitForIceGathering(pc)

    return {
      sdp: pc.localDescription!.sdp,
      iceCandidates: conn.pendingIceCandidates,
      peerId: this.localPeerId,
    }
  }

  async handleIncomingOffer(data: ManualConnectionData): Promise<ManualConnectionData> {
    const remotePeerId = data.peerId || uuidv4().replace(/-/g, '')
    const peerIdRef = { current: remotePeerId }
    const pc = this.createPeerConnection(peerIdRef)

    const conn: PeerConnection = {
      pc,
      controlChannel: null,
      ephemeralChannel: null,
      pendingIceCandidates: [],
      pingInterval: null,
      pingTimestamps: new Map(),
      peerIdRef,
    }
    this.connections.set(remotePeerId, conn)

    this.updateState(remotePeerId, 'signaling')

    await pc.setRemoteDescription({ type: 'offer', sdp: data.sdp })

    for (const candidate of data.iceCandidates) {
      await pc.addIceCandidate(candidate)
    }

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await this.waitForIceGathering(pc)

    return {
      sdp: pc.localDescription!.sdp,
      iceCandidates: conn.pendingIceCandidates,
      peerId: this.localPeerId,
    }
  }

  async handleIncomingAnswer(tempId: string, data: ManualConnectionData): Promise<void> {
    const conn = this.connections.get(tempId)
    if (!conn) throw new Error(`No connection found for ${tempId}`)

    this.updateState(tempId, 'signaling')

    await conn.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp })

    for (const candidate of data.iceCandidates) {
      await conn.pc.addIceCandidate(candidate)
    }

    // Remap connection if remote peerId differs from temp
    if (data.peerId && data.peerId !== tempId) {
      conn.peerIdRef.current = data.peerId
      this.connections.delete(tempId)
      this.connections.set(data.peerId, conn)
      useConnectionStore.getState().removeConnection(tempId)
      this.updateState(data.peerId, 'signaling')
    }
  }

  // --- Signaling-assisted connection ---

  async connectViaSignaling(
    peerId: string,
    sendSignal: (msg: { type: string; to: string; sdp?: string; candidate?: RTCIceCandidateInit }) => void
  ): Promise<void> {
    const peerIdRef = { current: peerId }
    const pc = this.createPeerConnection(peerIdRef)

    const controlChannel = pc.createDataChannel('control', { ordered: true })
    const ephemeralChannel = pc.createDataChannel('ephemeral', {
      ordered: false,
      maxRetransmits: 0,
    })

    const conn: PeerConnection = {
      pc,
      controlChannel,
      ephemeralChannel,
      pendingIceCandidates: [],
      pingInterval: null,
      pingTimestamps: new Map(),
      peerIdRef,
    }
    this.connections.set(peerId, conn)

    this.setupControlChannel(peerIdRef, controlChannel)
    this.setupEphemeralChannel(peerIdRef, ephemeralChannel)

    // Trickle ICE: send candidates as they arrive
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: 'ice-candidate', to: peerId, candidate: event.candidate.toJSON() })
      }
    }

    this.updateState(peerId, 'connecting')

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    sendSignal({ type: 'offer', to: peerId, sdp: offer.sdp! })
  }

  async handleSignalingOffer(
    peerId: string,
    sdp: string,
    sendSignal: (msg: { type: string; to: string; sdp?: string; candidate?: RTCIceCandidateInit }) => void
  ): Promise<void> {
    const peerIdRef = { current: peerId }
    const pc = this.createPeerConnection(peerIdRef)

    const conn: PeerConnection = {
      pc,
      controlChannel: null,
      ephemeralChannel: null,
      pendingIceCandidates: [],
      pingInterval: null,
      pingTimestamps: new Map(),
      peerIdRef,
    }
    this.connections.set(peerId, conn)

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({ type: 'ice-candidate', to: peerId, candidate: event.candidate.toJSON() })
      }
    }

    this.updateState(peerId, 'signaling')

    await pc.setRemoteDescription({ type: 'offer', sdp })
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    sendSignal({ type: 'answer', to: peerId, sdp: answer.sdp! })
  }

  async handleSignalingAnswer(peerId: string, sdp: string): Promise<void> {
    const conn = this.connections.get(peerId)
    if (!conn) return
    await conn.pc.setRemoteDescription({ type: 'answer', sdp })
  }

  async handleSignalingIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const conn = this.connections.get(peerId)
    if (!conn) return
    if (conn.pc.remoteDescription) {
      await conn.pc.addIceCandidate(candidate)
    } else {
      conn.pendingIceCandidates.push(candidate)
    }
  }

  // --- Messaging ---

  async sendMessage<T extends MessageType>(peerId: string, message: NeonP2PMessage<T>): Promise<boolean> {
    const conn = this.connections.get(peerId)
    if (!conn?.controlChannel || conn.controlChannel.readyState !== 'open') return false

    // Sign message if enabled (skip PING/PONG for performance)
    if (useSettingsStore.getState().messageSigning && message.type !== 'PING' && message.type !== 'PONG') {
      try {
        const signature = await getCryptoManager().signMessage(message as unknown as Record<string, unknown>)
        ;(message as NeonP2PMessage).signature = signature
      } catch {
        // Send unsigned on failure
      }
    }

    const data = JSON.stringify(message)
    if (data.length > PROTOCOL_CONSTANTS.MAX_MESSAGE_SIZE) return false

    conn.controlChannel.send(data)
    return true
  }

  async sendEphemeral<T extends MessageType>(peerId: string, message: NeonP2PMessage<T>): Promise<boolean> {
    const conn = this.connections.get(peerId)
    const channel = conn?.ephemeralChannel
    if (!channel || channel.readyState !== 'open') {
      // Fall back to control channel
      return this.sendMessage(peerId, message)
    }
    channel.send(JSON.stringify(message))
    return true
  }

  // --- HELLO handshake ---

  private sendHello(peerId: string): void {
    const profile = usePeerStore.getState().localProfile
    if (!profile) return

    const msg = createMessage('HELLO', profile.id, peerId, {
      displayName: profile.displayName,
      publicKey: profile.publicKey,
      capabilities: profile.capabilities,
    })
    this.sendMessage(peerId, msg)
  }

  // --- PING/PONG keepalive ---

  private startPingPong(peerId: string): void {
    const conn = this.connections.get(peerId)
    if (!conn) return

    this.stopPingPong(peerId)

    conn.pingInterval = setInterval(() => {
      if (this._destroyed) return

      const connInfo = useConnectionStore.getState().getConnection(peerId)
      const missedPongs = (connInfo?.missedPongs ?? 0) + 1

      if (missedPongs > PROTOCOL_CONSTANTS.MAX_MISSED_PONGS) {
        this.handlePeerTimeout(peerId)
        return
      }

      const seq = (connInfo?.lastPingSeq ?? 0) + 1
      conn.pingTimestamps.set(seq, Date.now())

      useConnectionStore.getState().updatePingPong(peerId, {
        lastPingSeq: seq,
        missedPongs,
      })

      const profile = usePeerStore.getState().localProfile
      if (!profile) return

      const pingMsg = createMessage('PING', profile.id, peerId, { seq })
      this.sendMessage(peerId, pingMsg)
    }, PROTOCOL_CONSTANTS.PING_INTERVAL_MS)
  }

  private stopPingPong(peerId: string): void {
    const conn = this.connections.get(peerId)
    if (conn?.pingInterval) {
      clearInterval(conn.pingInterval)
      conn.pingInterval = null
    }
  }

  handlePong(peerId: string, seq: number): void {
    const conn = this.connections.get(peerId)
    if (!conn) return

    const sentTime = conn.pingTimestamps.get(seq)
    const rttMs = sentTime ? Date.now() - sentTime : null
    conn.pingTimestamps.delete(seq)

    useConnectionStore.getState().updatePingPong(peerId, {
      missedPongs: 0,
      lastPongTime: Date.now(),
      rttMs,
    })
  }

  private handlePeerTimeout(peerId: string): void {
    this.stopPingPong(peerId)
    this.updateState(peerId, 'failed')
    this.emit('peer-disconnected', peerId)
    this.closeConnection(peerId)
  }

  // --- Connection management ---

  closeConnection(peerId: string): void {
    const conn = this.connections.get(peerId)
    if (!conn) return

    this.userInitiatedCloses.add(peerId)

    // Send DISCONNECT if possible
    const profile = usePeerStore.getState().localProfile
    if (profile && conn.controlChannel?.readyState === 'open') {
      const msg = createMessage('DISCONNECT', profile.id, peerId, {
        reason: 'User disconnected',
        code: 'USER_INITIATED',
      })
      try {
        conn.controlChannel.send(JSON.stringify(msg))
      } catch {
        // Ignore send errors during cleanup
      }
    }

    this.stopPingPong(peerId)
    conn.controlChannel?.close()
    conn.ephemeralChannel?.close()
    conn.pc.close()
    this.connections.delete(peerId)
    this.updateState(peerId, 'disconnected')
  }

  getDataChannel(peerId: string): RTCDataChannel | null {
    return this.connections.get(peerId)?.controlChannel ?? null
  }

  getPeerConnection(peerId: string): RTCPeerConnection | null {
    return this.connections.get(peerId)?.pc ?? null
  }

  isConnected(peerId: string): boolean {
    const conn = this.connections.get(peerId)
    return conn?.controlChannel?.readyState === 'open'
  }

  getConnectedPeerIds(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, conn]) => conn.controlChannel?.readyState === 'open')
      .map(([id]) => id)
  }

  destroy(): void {
    this._destroyed = true
    for (const peerId of this.connections.keys()) {
      this.closeConnection(peerId)
    }
    this.eventListeners.clear()
  }

  // --- Utilities ---

  private updateState(peerId: string, state: ConnectionState): void {
    useConnectionStore.getState().setConnectionState(peerId, state)
  }

  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve()
        return
      }
      const timeout = setTimeout(() => resolve(), 5000)
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout)
          resolve()
        }
      }
    })
  }

  // Expose temp connection IDs for manual flow
  getTemporaryConnectionIds(): string[] {
    return Array.from(this.connections.keys())
  }
}

// Singleton instance
let connectionManagerInstance: ConnectionManager | null = null

export function getConnectionManager(): ConnectionManager {
  if (!connectionManagerInstance) {
    connectionManagerInstance = new ConnectionManager()
  }
  return connectionManagerInstance
}
