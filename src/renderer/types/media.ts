import type { QualityPreset } from './protocol'

export interface QualityPresetConfig {
  width: number
  height: number
  frameRate: number
  videoBitrate: number
  audioBitrate: number
}

export const QUALITY_PRESETS: Record<Exclude<QualityPreset, 'adaptive'>, QualityPresetConfig> = {
  low: {
    width: 320,
    height: 240,
    frameRate: 15,
    videoBitrate: 200_000,
    audioBitrate: 32_000,
  },
  medium: {
    width: 640,
    height: 480,
    frameRate: 24,
    videoBitrate: 800_000,
    audioBitrate: 64_000,
  },
  high: {
    width: 1280,
    height: 720,
    frameRate: 30,
    videoBitrate: 1_500_000,
    audioBitrate: 128_000,
  },
  ultra: {
    width: 1920,
    height: 1080,
    frameRate: 30,
    videoBitrate: 4_000_000,
    audioBitrate: 128_000,
  },
}

export interface RemoteStream {
  peerId: string
  stream: MediaStream
  audioMuted: boolean
  videoEnabled: boolean
}

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor'
