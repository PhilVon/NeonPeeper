// SFU Bridge stub — deferred to v1.1
// Community video/audio channels will use mediasoup via this bridge.
// For v1, community channels are text-only.

export class SFUBridge {
  async init(): Promise<void> {
    console.log('[SFUBridge] SFU support for community channels is not yet implemented (v1.1)')
  }

  close(): void {
    // No-op for now
  }
}
