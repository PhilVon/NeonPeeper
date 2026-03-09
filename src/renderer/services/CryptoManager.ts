/**
 * CryptoManager - Ed25519 identity, message signing, TOFU peer verification (Phase 9)
 *
 * Uses Web Crypto API for:
 * - Ed25519 keypair generation
 * - Message signing and verification
 * - TOFU (Trust On First Use) key pinning
 * - Safety number generation for out-of-band verification
 * - Passphrase-encrypted key storage in IndexedDB
 */

const PBKDF2_ITERATIONS = 600_000

export interface StoredKeypair {
  id: string
  encryptedPrivateKey: string
  publicKey: string
  salt: string
  createdAt: number
}

export interface TrustedPeer {
  peerId: string
  publicKey: string
  firstSeen: number
  verified: boolean
  remoteVerified: boolean
}

export class CryptoManager {
  private keyPair: CryptoKeyPair | null = null
  private trustedPeers = new Map<string, TrustedPeer>()
  private dhKeyPair: CryptoKeyPair | null = null
  private sharedKeys = new Map<string, CryptoKey>()
  private _dhPublicKeyHex: string = ''

  // --- Key Generation ---

  async generateKeyPair(): Promise<CryptoKeyPair> {
    try {
      this.keyPair = await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify']
      ) as CryptoKeyPair
      return this.keyPair
    } catch {
      // Ed25519 may not be supported in all browsers
      // Fallback: generate ECDSA P-256 keys as workaround
      this.keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      )
      return this.keyPair
    }
  }

  async getPublicKeyHex(): Promise<string> {
    if (!this.keyPair) throw new Error('No keypair generated')
    const raw = await crypto.subtle.exportKey('raw', this.keyPair.publicKey)
    return this.bufferToHex(raw)
  }

  async derivePeerId(): Promise<string> {
    const publicKeyHex = await this.getPublicKeyHex()
    const publicKeyBytes = this.hexToBuffer(publicKeyHex)
    const hash = await crypto.subtle.digest('SHA-256', publicKeyBytes)
    // Take first 16 bytes (128 bits), hex encode → 32 char hex string
    return this.bufferToHex(hash.slice(0, 16))
  }

  // --- Diffie-Hellman Key Exchange ---

  async initDHKeyPair(): Promise<void> {
    try {
      // Try X25519 first (not widely supported yet)
      this.dhKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      )
    } catch {
      // Fallback already using P-256
      this.dhKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      )
    }
    const raw = await crypto.subtle.exportKey('raw', this.dhKeyPair.publicKey)
    this._dhPublicKeyHex = this.bufferToHex(raw)
  }

  getDHPublicKeyHex(): string {
    return this._dhPublicKeyHex
  }

  async deriveSharedKey(peerId: string, remoteDHHex: string): Promise<void> {
    if (!this.dhKeyPair) return

    const remoteKeyBytes = this.hexToBuffer(remoteDHHex)
    const remotePublicKey = await crypto.subtle.importKey(
      'raw',
      remoteKeyBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    )

    const sharedKey = await crypto.subtle.deriveKey(
      { name: 'ECDH', public: remotePublicKey },
      this.dhKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )

    this.sharedKeys.set(peerId, sharedKey)
  }

  async encryptPayload(peerId: string, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
    const key = this.sharedKeys.get(peerId)
    if (!key) throw new Error('No shared key for peer')

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoder = new TextEncoder()
    const data = encoder.encode(plaintext)

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    )

    return {
      ciphertext: this.bufferToHex(encrypted),
      iv: this.bufferToHex(iv.buffer as ArrayBuffer),
    }
  }

  async decryptPayload(peerId: string, ciphertextHex: string, ivHex: string): Promise<string> {
    const key = this.sharedKeys.get(peerId)
    if (!key) throw new Error('No shared key for peer')

    const ciphertext = this.hexToBuffer(ciphertextHex)
    const iv = this.hexToBuffer(ivHex)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  }

  hasSharedKey(peerId: string): boolean {
    return this.sharedKeys.has(peerId)
  }

  // --- Key Export/Import ---

  async exportSigningKeyPair(): Promise<{ privateKey: ArrayBuffer; publicKey: ArrayBuffer; algorithm: 'Ed25519' | 'ECDSA-P256' }> {
    if (!this.keyPair) throw new Error('No signing keypair')
    const privateKey = await crypto.subtle.exportKey('pkcs8', this.keyPair.privateKey)
    const publicKey = await crypto.subtle.exportKey('raw', this.keyPair.publicKey)
    const algorithm = this.keyPair.privateKey.algorithm.name === 'Ed25519' ? 'Ed25519' as const : 'ECDSA-P256' as const
    return { privateKey, publicKey, algorithm }
  }

  async importSigningKeyPair(privateKey: ArrayBuffer, publicKey: ArrayBuffer, algorithm: 'Ed25519' | 'ECDSA-P256'): Promise<void> {
    const algo = algorithm === 'Ed25519'
      ? { name: 'Ed25519' }
      : { name: 'ECDSA', namedCurve: 'P-256' }
    const importedPrivate = await crypto.subtle.importKey('pkcs8', privateKey, algo, true, ['sign'])
    const importedPublic = await crypto.subtle.importKey('raw', publicKey, algo, true, ['verify'])
    this.keyPair = { privateKey: importedPrivate, publicKey: importedPublic }
  }

  async exportDHKeyPair(): Promise<{ privateKey: ArrayBuffer; publicKey: ArrayBuffer }> {
    if (!this.dhKeyPair) throw new Error('No DH keypair')
    const privateKey = await crypto.subtle.exportKey('pkcs8', this.dhKeyPair.privateKey)
    const publicKey = await crypto.subtle.exportKey('raw', this.dhKeyPair.publicKey)
    return { privateKey, publicKey }
  }

  async importDHKeyPair(privateKey: ArrayBuffer, publicKey: ArrayBuffer): Promise<void> {
    const algo = { name: 'ECDH', namedCurve: 'P-256' }
    const importedPrivate = await crypto.subtle.importKey('pkcs8', privateKey, algo, true, ['deriveKey', 'deriveBits'])
    const importedPublic = await crypto.subtle.importKey('raw', publicKey, algo, true, [])
    this.dhKeyPair = { privateKey: importedPrivate, publicKey: importedPublic }
    const raw = await crypto.subtle.exportKey('raw', importedPublic)
    this._dhPublicKeyHex = this.bufferToHex(raw)
  }

  // --- Message Signing ---

  async signMessage(messageData: Record<string, unknown>): Promise<string> {
    if (!this.keyPair?.privateKey) throw new Error('No private key')

    // Create canonical JSON (sorted keys, exclude 'signature')
    const canonical = JSON.stringify(
      Object.keys(messageData)
        .filter((k) => k !== 'signature')
        .sort()
        .reduce<Record<string, unknown>>((obj, k) => {
          obj[k] = messageData[k]
          return obj
        }, {})
    )

    const encoder = new TextEncoder()
    const data = encoder.encode(canonical)

    try {
      const signature = await crypto.subtle.sign('Ed25519', this.keyPair.privateKey, data)
      return this.bufferToHex(signature)
    } catch {
      // Fallback to ECDSA
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        this.keyPair.privateKey,
        data
      )
      return this.bufferToHex(signature)
    }
  }

  async verifySignature(
    messageData: Record<string, unknown>,
    signatureHex: string,
    publicKeyHex: string
  ): Promise<boolean> {
    const canonical = JSON.stringify(
      Object.keys(messageData)
        .filter((k) => k !== 'signature')
        .sort()
        .reduce<Record<string, unknown>>((obj, k) => {
          obj[k] = messageData[k]
          return obj
        }, {})
    )

    const encoder = new TextEncoder()
    const data = encoder.encode(canonical)
    const signature = this.hexToBuffer(signatureHex)

    try {
      const publicKey = await crypto.subtle.importKey(
        'raw',
        this.hexToBuffer(publicKeyHex),
        { name: 'Ed25519' },
        false,
        ['verify']
      )
      return crypto.subtle.verify('Ed25519', publicKey, signature, data)
    } catch {
      // Fallback ECDSA
      try {
        const publicKey = await crypto.subtle.importKey(
          'raw',
          this.hexToBuffer(publicKeyHex),
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify']
        )
        return crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          publicKey,
          signature,
          data
        )
      } catch {
        return false
      }
    }
  }

  // --- TOFU Key Pinning ---

  trustPeer(peerId: string, publicKey: string): { trusted: boolean; changed: boolean } {
    const existing = this.trustedPeers.get(peerId)

    if (!existing) {
      // First connection — trust on first use
      this.trustedPeers.set(peerId, {
        peerId,
        publicKey,
        firstSeen: Date.now(),
        verified: false,
        remoteVerified: false,
      })
      return { trusted: true, changed: false }
    }

    if (existing.publicKey !== publicKey) {
      // Key changed! Possible impersonation
      return { trusted: false, changed: true }
    }

    return { trusted: true, changed: false }
  }

  markPeerVerified(peerId: string): void {
    const peer = this.trustedPeers.get(peerId)
    if (peer) {
      peer.verified = true
    }
  }

  markRemoteVerified(peerId: string): void {
    const peer = this.trustedPeers.get(peerId)
    if (peer) {
      peer.remoteVerified = true
    }
  }

  isTrusted(peerId: string): boolean {
    return this.trustedPeers.has(peerId)
  }

  isVerified(peerId: string): boolean {
    return this.trustedPeers.get(peerId)?.verified ?? false
  }

  isMutuallyVerified(peerId: string): boolean {
    const peer = this.trustedPeers.get(peerId)
    if (!peer) return false
    return peer.verified && peer.remoteVerified
  }

  // --- Safety Numbers ---

  async generateSafetyNumber(remotePublicKeyHex: string): Promise<string> {
    const localKeyHex = await this.getPublicKeyHex()
    const localBytes = this.hexToBuffer(localKeyHex)
    const remoteBytes = this.hexToBuffer(remotePublicKeyHex)

    // Deterministic order
    const localArr = new Uint8Array(localBytes)
    const remoteArr = new Uint8Array(remoteBytes)

    let combined: Uint8Array
    if (this.compareArrays(localArr, remoteArr) < 0) {
      combined = new Uint8Array(localArr.length + remoteArr.length)
      combined.set(localArr, 0)
      combined.set(remoteArr, localArr.length)
    } else {
      combined = new Uint8Array(remoteArr.length + localArr.length)
      combined.set(remoteArr, 0)
      combined.set(localArr, remoteArr.length)
    }

    const hash = await crypto.subtle.digest('SHA-256', combined as BufferSource)
    const hashArr = new Uint8Array(hash)

    // Format as XXXX-XXXX (8 digits, ~26 bits of entropy)
    const group1 = ((hashArr[0] << 8) | hashArr[1]) % 10000
    const group2 = ((hashArr[2] << 8) | hashArr[3]) % 10000
    return `${group1.toString().padStart(4, '0')}-${group2.toString().padStart(4, '0')}`
  }

  // --- Key Storage ---

  async encryptPrivateKey(passphrase: string): Promise<StoredKeypair> {
    if (!this.keyPair) throw new Error('No keypair')

    const encoder = new TextEncoder()
    const salt = crypto.getRandomValues(new Uint8Array(16))

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    )

    const derivedKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    )

    const rawPrivate = await crypto.subtle.exportKey('pkcs8', this.keyPair.privateKey)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      rawPrivate
    )

    const encryptedArr = new Uint8Array(encrypted)
    const combined = new Uint8Array(iv.length + encryptedArr.length)
    combined.set(iv, 0)
    combined.set(encryptedArr, iv.length)

    const publicKeyHex = await this.getPublicKeyHex()

    return {
      id: 'identity',
      encryptedPrivateKey: this.bufferToHex(combined.buffer as ArrayBuffer),
      publicKey: publicKeyHex,
      salt: this.bufferToHex(salt.buffer),
      createdAt: Date.now(),
    }
  }

  // --- Utilities ---

  private bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  private hexToBuffer(hex: string): ArrayBuffer {
    if (typeof hex !== 'string' || hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error('Invalid hex string')
    }
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
    }
    return bytes.buffer
  }

  private compareArrays(a: Uint8Array, b: Uint8Array): number {
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i++) {
      if (a[i] < b[i]) return -1
      if (a[i] > b[i]) return 1
    }
    return a.length - b.length
  }
}

let cryptoManagerInstance: CryptoManager | null = null

export function getCryptoManager(): CryptoManager {
  if (!cryptoManagerInstance) {
    cryptoManagerInstance = new CryptoManager()
  }
  return cryptoManagerInstance
}
