import { create } from 'zustand'

interface UIState {
  crtEnabled: boolean
  toggleCRT: () => void
  setCRTEnabled: (enabled: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  crtEnabled: false,
  toggleCRT: () => set((state) => ({ crtEnabled: !state.crtEnabled })),
  setCRTEnabled: (enabled) => set({ crtEnabled: enabled })
}))
