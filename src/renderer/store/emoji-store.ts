import { create } from 'zustand'
import type { CustomEmoji } from '../types/emoji'
import { getPersistenceManager } from '../services/PersistenceManager'

interface EmojiState {
  emojis: CustomEmoji[]
  peerEmojiCache: Map<string, Map<string, string>> // peerId -> shortcode -> dataUrl

  loadEmojis: () => Promise<void>
  addEmoji: (emoji: CustomEmoji) => Promise<void>
  removeEmoji: (id: string) => Promise<void>
  updateEmojiShortcode: (id: string, shortcode: string) => Promise<void>
  getEmojiByShortcode: (shortcode: string) => CustomEmoji | undefined

  cachePeerEmoji: (peerId: string, shortcode: string, dataUrl: string) => void
  getCachedPeerEmoji: (peerId: string, shortcode: string) => string | undefined
}

export const useEmojiStore = create<EmojiState>()((set, get) => ({
  emojis: [],
  peerEmojiCache: new Map(),

  loadEmojis: async () => {
    try {
      const emojis = await getPersistenceManager().getAllCustomEmojis()
      set({ emojis })
    } catch (err) {
      console.error('[EmojiStore] Failed to load emojis:', err)
    }
  },

  addEmoji: async (emoji) => {
    const current = get().emojis
    if (current.length >= 50) return
    set({ emojis: [...current, emoji] })
    await getPersistenceManager().storeCustomEmoji(emoji).catch(() => {})
  },

  removeEmoji: async (id) => {
    set({ emojis: get().emojis.filter((e) => e.id !== id) })
    await getPersistenceManager().deleteCustomEmoji(id).catch(() => {})
  },

  updateEmojiShortcode: async (id, shortcode) => {
    const emojis = get().emojis.map((e) =>
      e.id === id ? { ...e, shortcode } : e
    )
    set({ emojis })
    const emoji = emojis.find((e) => e.id === id)
    if (emoji) {
      await getPersistenceManager().storeCustomEmoji(emoji).catch(() => {})
    }
  },

  getEmojiByShortcode: (shortcode) => {
    return get().emojis.find((e) => e.shortcode === shortcode)
  },

  cachePeerEmoji: (peerId, shortcode, dataUrl) => {
    const cache = new Map(get().peerEmojiCache)
    if (!cache.has(peerId)) {
      cache.set(peerId, new Map())
    }
    cache.get(peerId)!.set(shortcode, dataUrl)
    set({ peerEmojiCache: cache })
    getPersistenceManager().cachePeerEmoji(peerId, shortcode, dataUrl).catch(() => {})
  },

  getCachedPeerEmoji: (peerId, shortcode) => {
    return get().peerEmojiCache.get(peerId)?.get(shortcode)
  },
}))
