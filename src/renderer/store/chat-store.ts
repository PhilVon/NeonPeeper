import { create } from 'zustand'
import type { Chat, ChatMessage } from '../types/chat'

interface ChatState {
  chats: Map<string, Chat>
  messages: Map<string, ChatMessage[]>
  activeChatId: string | null
  typing: Map<string, Map<string, number>> // chatId -> peerId -> timestamp

  setActiveChat: (chatId: string | null) => void
  upsertChat: (chat: Chat) => void
  addMessage: (message: ChatMessage) => void
  updateMessageStatus: (messageId: string, chatId: string, status: ChatMessage['status']) => void
  editMessage: (messageId: string, chatId: string, content: string, editedAt: number) => void
  deleteMessage: (messageId: string, chatId: string) => void
  setTyping: (chatId: string, peerId: string, isTyping: boolean) => void
  updateMessageEncrypted: (messageId: string, chatId: string) => void
  markAsRead: (chatId: string) => void
  loadOlderMessages: (chatId: string, messages: ChatMessage[]) => void
  removeChat: (chatId: string) => void
  clearAll: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  chats: new Map(),
  messages: new Map(),
  activeChatId: null,
  typing: new Map(),

  setActiveChat: (chatId) => set({ activeChatId: chatId }),

  upsertChat: (chat) =>
    set((state) => {
      const chats = new Map(state.chats)
      chats.set(chat.id, chat)
      return { chats }
    }),

  addMessage: (message) =>
    set((state) => {
      const messages = new Map(state.messages)
      const existing = messages.get(message.chatId) ?? []

      // Deduplicate: skip if message ID already present
      if (existing.some((m) => m.id === message.id)) return state

      const chatMessages = [...existing, message]
      messages.set(message.chatId, chatMessages)

      // Update chat last activity
      const chats = new Map(state.chats)
      const chat = chats.get(message.chatId)
      if (chat) {
        const isActive = state.activeChatId === message.chatId
        chats.set(message.chatId, {
          ...chat,
          lastActivity: message.timestamp,
          lastMessageId: message.id,
          lastMessagePreview: message.contentType === 'gif' ? '[GIF]' : message.content.slice(0, 100),
          unreadCount: isActive ? chat.unreadCount : chat.unreadCount + 1,
        })
      }

      return { messages, chats }
    }),

  updateMessageStatus: (messageId, chatId, status) =>
    set((state) => {
      const messages = new Map(state.messages)
      const chatMessages = messages.get(chatId)
      if (!chatMessages) return state

      const updated = chatMessages.map((m) =>
        m.id === messageId ? { ...m, status } : m
      )
      messages.set(chatId, updated)
      return { messages }
    }),

  editMessage: (messageId, chatId, content, editedAt) =>
    set((state) => {
      const messages = new Map(state.messages)
      const chatMessages = messages.get(chatId)
      if (!chatMessages) return state

      const updated = chatMessages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              content,
              edited: { editedAt, originalContent: m.edited?.originalContent ?? m.content },
            }
          : m
      )
      messages.set(chatId, updated)
      return { messages }
    }),

  deleteMessage: (messageId, chatId) =>
    set((state) => {
      const messages = new Map(state.messages)
      const chatMessages = messages.get(chatId)
      if (!chatMessages) return state

      const updated = chatMessages.map((m) =>
        m.id === messageId ? { ...m, deleted: true, content: '' } : m
      )
      messages.set(chatId, updated)
      return { messages }
    }),

  setTyping: (chatId, peerId, isTyping) =>
    set((state) => {
      const typing = new Map(state.typing)
      const chatTyping = new Map(typing.get(chatId) ?? new Map())
      if (isTyping) {
        chatTyping.set(peerId, Date.now())
      } else {
        chatTyping.delete(peerId)
      }
      typing.set(chatId, chatTyping)
      return { typing }
    }),

  updateMessageEncrypted: (messageId, chatId) =>
    set((state) => {
      const messages = new Map(state.messages)
      const chatMessages = messages.get(chatId)
      if (!chatMessages) return state
      const updated = chatMessages.map((m) =>
        m.id === messageId ? { ...m, encrypted: true } : m
      )
      messages.set(chatId, updated)
      return { messages }
    }),

  markAsRead: (chatId) =>
    set((state) => {
      const chat = state.chats.get(chatId)
      if (!chat || chat.unreadCount === 0) return state
      const chats = new Map(state.chats)
      chats.set(chatId, { ...chat, unreadCount: 0 })
      return { chats }
    }),

  loadOlderMessages: (chatId, olderMessages) =>
    set((state) => {
      const messages = new Map(state.messages)
      const existing = messages.get(chatId) ?? []
      messages.set(chatId, [...olderMessages, ...existing])
      return { messages }
    }),

  removeChat: (chatId) =>
    set((state) => {
      const chats = new Map(state.chats)
      const messages = new Map(state.messages)
      chats.delete(chatId)
      messages.delete(chatId)
      return { chats, messages, activeChatId: state.activeChatId === chatId ? null : state.activeChatId }
    }),

  clearAll: () =>
    set({ chats: new Map(), messages: new Map(), activeChatId: null, typing: new Map() }),
}))
