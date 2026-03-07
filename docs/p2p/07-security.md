# P2P Chat System — Security

> Transport encryption, peer identity, message signing, and threat model.

---

## Table of Contents

- [Transport Encryption](#transport-encryption)
- [Peer Identity](#peer-identity)
- [Peer Verification](#peer-verification)
- [Message Authentication](#message-authentication)
- [Optional End-to-End Encryption](#optional-end-to-end-encryption)
- [Keypair Storage](#keypair-storage)
- [Threat Model](#threat-model)

---

## Transport Encryption

WebRTC provides **mandatory** encryption for all data:

| Layer | Encryption | Covers |
|-------|------------|--------|
| DataChannels | **DTLS 1.2** | Text messages, protocol control |
| Media streams | **SRTP** (with DTLS key exchange) | Audio, video |
| Signaling | **WSS (TLS)** | SDP offers/answers, ICE candidates |

### What This Means

- **All data** between peers is encrypted in transit — zero configuration needed
- The DTLS handshake happens automatically during WebRTC connection setup
- SRTP keys are derived from the DTLS handshake
- Even TURN relay servers **cannot** decrypt the content (they see encrypted bytes)
- The signaling server sees SDP metadata (codecs, IP addresses) but not message content

### What This Does NOT Cover

- **Signaling metadata**: The signaling server knows which peers are connecting to each other
- **Peer identity**: DTLS encrypts the channel but doesn't verify who's on the other end
- **Server trust**: If using a TURN server, the operator knows that traffic is flowing
- **Application data at rest**: Messages stored in IndexedDB are not encrypted by default

---

## Peer Identity

Each peer generates an **Ed25519 keypair** for identity.

### Why Ed25519

| Property | Value |
|----------|-------|
| Key size | 32 bytes (public), 64 bytes (private) |
| Signature size | 64 bytes |
| Performance | ~76,000 signs/sec, ~29,000 verifies/sec |
| Security | 128-bit equivalent |
| Web Crypto | Supported via `Ed25519` algorithm |

### Keypair Generation

```typescript
async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'Ed25519' },
    true,  // extractable (needed for export/storage)
    ['sign', 'verify']
  )
}
```

### Peer ID Derivation

The peer ID is derived from the public key:

```typescript
async function derivePeerId(publicKey: CryptoKey): Promise<string> {
  // Export public key as raw bytes
  const rawKey = await crypto.subtle.exportKey('raw', publicKey)

  // SHA-256 hash
  const hash = await crypto.subtle.digest('SHA-256', rawKey)

  // Take first 16 bytes, hex-encode
  const bytes = new Uint8Array(hash).slice(0, 16)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
```

- Peer ID is a **32-character hex string** (16 bytes of SHA-256)
- Deterministic: same public key always produces the same peer ID
- Collision-resistant: 128 bits of entropy from SHA-256 truncation

### Public Key Exchange

Public keys are exchanged in the `HELLO` / `HELLO_ACK` messages:

```typescript
// In HELLO payload
{
  displayName: 'Alice',
  publicKey: '302a300506032b6570032100...',  // hex-encoded raw public key
  capabilities: ['text', 'media']
}
```

---

## Peer Verification

### Trust On First Use (TOFU)

Similar to SSH host key verification:

1. **First connection**: Accept the peer's public key and store it locally
2. **Subsequent connections**: Verify the presented key matches the stored key
3. **Key mismatch**: Alert the user — possible impersonation

```typescript
interface StoredPeerIdentity {
  peerId: string
  publicKeyHex: string
  displayName: string
  firstSeen: number
  lastSeen: number
  verified: boolean  // User manually verified via safety number
}

async function verifyPeerIdentity(
  peerId: string,
  presentedPublicKey: string
): Promise<'trusted' | 'new' | 'mismatch'> {
  const stored = await getStoredIdentity(peerId)

  if (!stored) {
    // First time seeing this peer
    await storeIdentity(peerId, presentedPublicKey)
    return 'new'
  }

  if (stored.publicKeyHex === presentedPublicKey) {
    // Key matches stored key
    await updateLastSeen(peerId)
    return 'trusted'
  }

  // Key changed! Possible impersonation
  return 'mismatch'
}
```

### Safety Number Comparison

For manual verification (like Signal's safety numbers):

```typescript
async function generateSafetyNumber(
  localPublicKey: CryptoKey,
  remotePublicKey: CryptoKey
): Promise<string> {
  const localRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localPublicKey))
  const remoteRaw = new Uint8Array(await crypto.subtle.exportKey('raw', remotePublicKey))

  // Concatenate in deterministic order (sort by bytes)
  const combined = localRaw < remoteRaw
    ? new Uint8Array([...localRaw, ...remoteRaw])
    : new Uint8Array([...remoteRaw, ...localRaw])

  // Hash and format as groups of digits
  const hash = await crypto.subtle.digest('SHA-256', combined)
  const bytes = new Uint8Array(hash)

  // Format as 12 groups of 5 digits (60 digits total)
  const numbers: string[] = []
  for (let i = 0; i < 30; i += 5) {
    const num = (bytes[i] << 8 | bytes[i + 1]) % 100000
    numbers.push(num.toString().padStart(5, '0'))
  }

  return numbers.join(' ')
  // Example: "12345 67890 11111 22222 33333 44444"
}
```

Users can compare safety numbers over a trusted channel (in person, phone call) to verify identity.

---

## Message Authentication

### Ed25519 Signatures

TEXT messages can be signed to ensure authenticity and integrity:

```typescript
async function signMessage(
  message: NeonP2PMessage,
  privateKey: CryptoKey
): Promise<string> {
  // Create canonical JSON (all fields except 'signature', sorted keys)
  const { signature, ...messageWithoutSig } = message
  const canonical = JSON.stringify(messageWithoutSig, Object.keys(messageWithoutSig).sort())

  // Sign
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)
  const sig = await crypto.subtle.sign('Ed25519', privateKey, data)

  // Return hex-encoded signature
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

async function verifySignature(
  message: NeonP2PMessage,
  publicKey: CryptoKey
): Promise<boolean> {
  const { signature, ...messageWithoutSig } = message
  if (!signature) return false

  const canonical = JSON.stringify(messageWithoutSig, Object.keys(messageWithoutSig).sort())
  const encoder = new TextEncoder()
  const data = encoder.encode(canonical)

  // Decode hex signature
  const sigBytes = new Uint8Array(
    signature.match(/.{2}/g)!.map(h => parseInt(h, 16))
  )

  return crypto.subtle.verify('Ed25519', publicKey, sigBytes, data)
}
```

### What Gets Signed

| Message Type | Signed? | Rationale |
|--------------|---------|-----------|
| TEXT | Yes | Content integrity |
| TEXT_EDIT | Yes | Verify original sender |
| TEXT_DELETE | Yes | Verify original sender |
| CHAT_CREATE | Yes | Verify creator |
| CHAT_INVITE | Yes | Verify inviter |
| HELLO / HELLO_ACK | No | Keys not yet exchanged |
| PING / PONG | No | No content to protect |
| TYPING_* | No | Ephemeral, low value |
| MEDIA_* | No | SDP integrity handled by DTLS |

---

## Optional End-to-End Encryption

For users who want encryption beyond DTLS (e.g., protecting against a compromised TURN relay), optional E2E encryption can be added.

### Key Exchange: X25519 Diffie-Hellman

```typescript
// Generate ephemeral X25519 keypair for key agreement
async function generateDHKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'X25519' },
    true,
    ['deriveKey']
  )
}

// Derive shared secret
async function deriveSharedKey(
  privateKey: CryptoKey,
  remotePublicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'X25519', public: remotePublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}
```

### Message Encryption: AES-256-GCM

```typescript
async function encryptPayload(
  payload: string,
  sharedKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoder = new TextEncoder()
  const data = encoder.encode(payload)

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    data
  )

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  }
}

async function decryptPayload(
  ciphertext: string,
  iv: string,
  sharedKey: CryptoKey
): Promise<string> {
  const encrypted = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    sharedKey,
    encrypted
  )

  return new TextDecoder().decode(decrypted)
}
```

### E2E Flow

```
  Peer A                                Peer B
    |                                     |
    | Generate X25519 keypair             |
    |--- DH public key (in HELLO) ------>|
    |                                     | Generate X25519 keypair
    |<--- DH public key (in HELLO_ACK) --|
    |                                     |
    | Both derive same AES-256 key        |
    |                                     |
    | [TEXT encrypted with AES-GCM] ====>|
    |<==== [TEXT_ACK] ===================|
```

---

## Keypair Storage

### Storage Location

Keypairs are stored in IndexedDB, encrypted with a user-provided passphrase.

```typescript
interface StoredKeypair {
  /** Key identifier */
  id: 'identity'

  /** Ed25519 private key, encrypted with passphrase-derived key */
  encryptedPrivateKey: string

  /** Ed25519 public key (not encrypted — it's public) */
  publicKey: string

  /** Salt for PBKDF2 passphrase derivation */
  salt: string

  /** Creation timestamp */
  createdAt: number
}
```

### Passphrase-Based Encryption

```typescript
async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600_000,  // OWASP recommendation
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}
```

### First-Time Setup Flow

```
1. User launches app for the first time
2. App generates Ed25519 keypair
3. App prompts user for a passphrase (or generates a recovery key)
4. Private key encrypted with passphrase-derived AES key
5. Encrypted private key + public key + salt stored in IndexedDB
6. Peer ID derived from public key and displayed to user
```

### Key Recovery

If a user loses their passphrase:
- Generate a new keypair (new identity)
- Re-verify with all peers (TOFU resets)
- Old messages remain readable (stored decrypted in IndexedDB)

---

## Threat Model

| Threat | Mitigation | Residual Risk |
|--------|------------|---------------|
| **Eavesdropping** (network) | DTLS-SRTP encrypts all WebRTC traffic | TURN server operator knows traffic metadata |
| **Man-in-the-Middle** | TOFU key pinning + safety number verification | First connection is trust-on-first-use |
| **Message tampering** | Ed25519 signatures on TEXT messages | Unsigned message types can be tampered |
| **Impersonation** | Peer ID derived from public key | First contact requires out-of-band verification |
| **Replay attacks** | Message ID deduplication + timestamps | Clock skew could allow narrow replay window |
| **Signaling server compromise** | Server only sees SDP metadata, not message content | Attacker could inject fake peers (MITM on signaling) |
| **Local device compromise** | Passphrase-encrypted private key | Full device access defeats all protections |
| **Metadata analysis** | Direct P2P connections (no central server) | IP addresses visible to peers; timing analysis possible |
| **Denial of service** | Rate limiting on signaling server | Large group flooding via mesh |

### Trust Boundaries

```
+-------------------------------------------------------------------+
|  TRUSTED                                                          |
|  - Local device (OS, Electron, Chromium)                          |
|  - WebRTC encryption (DTLS-SRTP)                                  |
|  - Web Crypto API (Ed25519, AES-GCM)                              |
+-------------------------------------------------------------------+
|  PARTIALLY TRUSTED                                                |
|  - Signaling server (sees metadata, not content)                  |
|  - STUN servers (learn your public IP)                            |
|  - TURN servers (relay encrypted bytes)                           |
+-------------------------------------------------------------------+
|  UNTRUSTED                                                        |
|  - Network path (ISP, Wi-Fi)    → encrypted by DTLS/SRTP         |
|  - Remote peers (before verification) → TOFU + safety numbers    |
+-------------------------------------------------------------------+
```

### Security Recommendations

1. **Always use WSS** for signaling in production (not plain WS)
2. **Self-host TURN** if relay privacy matters
3. **Verify safety numbers** for sensitive conversations
4. **Enable message signing** to detect tampering
5. **Use strong passphrases** for keypair storage
6. **Rotate X25519 DH keys** per session for forward secrecy

---

*Previous: [Media ←](./06-media.md) · Next: [Performance →](./08-performance.md)*
