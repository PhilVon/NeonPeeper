import { create } from 'zustand'

interface UIState {
  crtEnabled: boolean
  windowFocused: boolean
  toggleCRT: () => void
  setCRTEnabled: (enabled: boolean) => void
  setWindowFocused: (focused: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  crtEnabled: false,
  windowFocused: true,
  toggleCRT: () => set((state) => ({ crtEnabled: !state.crtEnabled })),
  setCRTEnabled: (enabled) => set({ crtEnabled: enabled }),
  setWindowFocused: (focused) => set({ windowFocused: focused }),
}))
