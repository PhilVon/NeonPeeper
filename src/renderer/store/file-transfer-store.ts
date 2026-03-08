import { create } from 'zustand'

export type TransferDirection = 'send' | 'receive'
export type TransferStatus = 'pending' | 'accepted' | 'transferring' | 'completed' | 'failed' | 'rejected'

export interface FileTransfer {
  transferId: string
  peerId: string
  chatId: string
  fileName: string
  fileSize: number
  mimeType: string
  direction: TransferDirection
  status: TransferStatus
  progress: number
  blobUrl?: string
}

interface FileTransferState {
  transfers: Map<string, FileTransfer>
  addTransfer: (transfer: FileTransfer) => void
  updateTransfer: (transferId: string, updates: Partial<FileTransfer>) => void
  setProgress: (transferId: string, progress: number) => void
  removeTransfer: (transferId: string) => void
  getTransfersForChat: (chatId: string) => FileTransfer[]
}

export const useFileTransferStore = create<FileTransferState>((set, get) => ({
  transfers: new Map(),

  addTransfer: (transfer) =>
    set((state) => {
      const next = new Map(state.transfers)
      next.set(transfer.transferId, transfer)
      return { transfers: next }
    }),

  updateTransfer: (transferId, updates) =>
    set((state) => {
      const existing = state.transfers.get(transferId)
      if (!existing) return state
      const next = new Map(state.transfers)
      next.set(transferId, { ...existing, ...updates })
      return { transfers: next }
    }),

  setProgress: (transferId, progress) =>
    set((state) => {
      const existing = state.transfers.get(transferId)
      if (!existing) return state
      const next = new Map(state.transfers)
      next.set(transferId, { ...existing, progress })
      return { transfers: next }
    }),

  removeTransfer: (transferId) =>
    set((state) => {
      const next = new Map(state.transfers)
      const transfer = next.get(transferId)
      if (transfer?.blobUrl) URL.revokeObjectURL(transfer.blobUrl)
      next.delete(transferId)
      return { transfers: next }
    }),

  getTransfersForChat: (chatId) => {
    return Array.from(get().transfers.values()).filter((t) => t.chatId === chatId)
  },
}))
