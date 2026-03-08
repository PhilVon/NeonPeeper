import { v4 as uuidv4 } from 'uuid'
import { getConnectionManager } from './ConnectionManager'
import { useFileTransferStore } from '../store/file-transfer-store'
import { usePeerStore } from '../store/peer-store'
import { createMessage, PROTOCOL_CONSTANTS } from '../types/protocol'

const CHUNK_SIZE = PROTOCOL_CONSTANTS.FILE_CHUNK_SIZE

// In-memory chunk storage for receiving files
const chunkBuffers = new Map<string, Map<number, string>>()

export class FileTransferManager {
  async offerFile(peerId: string, chatId: string, file: File): Promise<string> {
    const transferId = uuidv4()
    const fileHash = await this.hashFile(file)
    const localId = usePeerStore.getState().localProfile?.id ?? ''

    useFileTransferStore.getState().addTransfer({
      transferId,
      peerId,
      chatId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      direction: 'send',
      status: 'pending',
      progress: 0,
    })

    const msg = createMessage('FILE_OFFER', localId, peerId, {
      transferId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      fileHash,
    }, chatId)

    getConnectionManager().sendMessage(peerId, msg)

    // Store file reference for when accepted
    this.pendingFiles.set(transferId, { file, hash: fileHash })

    return transferId
  }

  private pendingFiles = new Map<string, { file: File; hash: string }>()

  acceptFile(transferId: string): void {
    const transfer = useFileTransferStore.getState().transfers.get(transferId)
    if (!transfer) return

    useFileTransferStore.getState().updateTransfer(transferId, { status: 'accepted' })

    const localId = usePeerStore.getState().localProfile?.id ?? ''
    const msg = createMessage('FILE_ACCEPT', localId, transfer.peerId, {
      transferId,
      accepted: true,
    }, transfer.chatId)
    getConnectionManager().sendMessage(transfer.peerId, msg)
  }

  rejectFile(transferId: string): void {
    const transfer = useFileTransferStore.getState().transfers.get(transferId)
    if (!transfer) return

    useFileTransferStore.getState().updateTransfer(transferId, { status: 'rejected' })

    const localId = usePeerStore.getState().localProfile?.id ?? ''
    const msg = createMessage('FILE_ACCEPT', localId, transfer.peerId, {
      transferId,
      accepted: false,
    }, transfer.chatId)
    getConnectionManager().sendMessage(transfer.peerId, msg)
  }

  handleFileOffer(peerId: string, chatId: string, payload: {
    transferId: string
    fileName: string
    fileSize: number
    mimeType: string
    fileHash: string
  }): void {
    useFileTransferStore.getState().addTransfer({
      transferId: payload.transferId,
      peerId,
      chatId,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      mimeType: payload.mimeType,
      direction: 'receive',
      status: 'pending',
      progress: 0,
    })
  }

  async handleFileAccept(payload: { transferId: string; accepted: boolean }): Promise<void> {
    const { transferId, accepted } = payload
    if (!accepted) {
      useFileTransferStore.getState().updateTransfer(transferId, { status: 'rejected' })
      this.pendingFiles.delete(transferId)
      return
    }

    useFileTransferStore.getState().updateTransfer(transferId, { status: 'transferring' })
    await this.sendChunks(transferId)
  }

  private async sendChunks(transferId: string): Promise<void> {
    const pending = this.pendingFiles.get(transferId)
    const transfer = useFileTransferStore.getState().transfers.get(transferId)
    if (!pending || !transfer) return

    const { file } = pending
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    const localId = usePeerStore.getState().localProfile?.id ?? ''
    const cm = getConnectionManager()

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const slice = file.slice(start, end)
      const buffer = await slice.arrayBuffer()
      const base64 = this.arrayBufferToBase64(buffer)

      const msg = createMessage('FILE_CHUNK', localId, transfer.peerId, {
        transferId,
        chunkIndex: i,
        totalChunks,
        data: base64,
      }, transfer.chatId)

      await cm.sendMessage(transfer.peerId, msg)

      const progress = Math.round(((i + 1) / totalChunks) * 100)
      useFileTransferStore.getState().setProgress(transferId, progress)

      // Yield every 10 chunks to avoid blocking
      if ((i + 1) % 10 === 0) {
        await new Promise((r) => setTimeout(r, 0))
      }
    }

    // Send completion
    const completeMsg = createMessage('FILE_COMPLETE', localId, transfer.peerId, {
      transferId,
      success: true,
    }, transfer.chatId)
    cm.sendMessage(transfer.peerId, completeMsg)

    useFileTransferStore.getState().updateTransfer(transferId, { status: 'completed', progress: 100 })
    this.pendingFiles.delete(transferId)
  }

  handleFileChunk(payload: {
    transferId: string
    chunkIndex: number
    totalChunks: number
    data: string
  }): void {
    const { transferId, chunkIndex, totalChunks, data } = payload

    if (!chunkBuffers.has(transferId)) {
      chunkBuffers.set(transferId, new Map())
    }
    chunkBuffers.get(transferId)!.set(chunkIndex, data)

    const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100)
    useFileTransferStore.getState().updateTransfer(transferId, {
      status: 'transferring',
      progress,
    })
  }

  async handleFileComplete(payload: { transferId: string; success: boolean }): Promise<void> {
    const { transferId, success } = payload
    if (!success) {
      useFileTransferStore.getState().updateTransfer(transferId, { status: 'failed' })
      chunkBuffers.delete(transferId)
      return
    }

    const transfer = useFileTransferStore.getState().transfers.get(transferId)
    const chunks = chunkBuffers.get(transferId)
    if (!transfer || !chunks) return

    // Reassemble chunks
    const sortedKeys = Array.from(chunks.keys()).sort((a, b) => a - b)
    const parts: Uint8Array[] = []
    for (const key of sortedKeys) {
      parts.push(this.base64ToUint8Array(chunks.get(key)!))
    }

    const blob = new Blob(parts as BlobPart[], { type: transfer.mimeType })
    const blobUrl = URL.createObjectURL(blob)

    useFileTransferStore.getState().updateTransfer(transferId, {
      status: 'completed',
      progress: 100,
      blobUrl,
    })

    chunkBuffers.delete(transferId)
  }

  private async hashFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer()
    const hash = await crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }
}

let fileTransferManagerInstance: FileTransferManager | null = null

export function getFileTransferManager(): FileTransferManager {
  if (!fileTransferManagerInstance) {
    fileTransferManagerInstance = new FileTransferManager()
  }
  return fileTransferManagerInstance
}
