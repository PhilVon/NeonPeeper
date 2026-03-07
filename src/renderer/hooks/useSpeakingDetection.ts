import { useEffect, useRef, useState, type RefObject } from 'react'

let sharedAudioContext: AudioContext | null = null

function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext()
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume()
  }
  return sharedAudioContext
}

interface SpeakingOptions {
  threshold?: number
  holdDuration?: number
}

export function useSpeakingDetection(
  stream: MediaStream | null,
  elementRef: RefObject<HTMLElement | null>,
  options?: SpeakingOptions
): { isSpeaking: boolean } {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const speakingRef = useRef(false)
  const holdTimerRef = useRef<number | null>(null)

  const threshold = options?.threshold ?? 0.015
  const holdDuration = options?.holdDuration ?? 300
  const [trackVersion, setTrackVersion] = useState(0)

  // Listen for track additions/removals on the stream
  useEffect(() => {
    if (!stream) return
    const bump = () => setTrackVersion((v) => v + 1)
    stream.addEventListener('addtrack', bump)
    stream.addEventListener('removetrack', bump)
    return () => {
      stream.removeEventListener('addtrack', bump)
      stream.removeEventListener('removetrack', bump)
    }
  }, [stream])

  useEffect(() => {
    if (!stream || !stream.getAudioTracks().some((t) => t.readyState === 'live')) {
      // No audio tracks — reset and bail
      if (speakingRef.current) {
        speakingRef.current = false
        setIsSpeaking(false)
      }
      if (elementRef.current) {
        elementRef.current.style.setProperty('--audio-level', '0')
      }
      return
    }

    const ctx = getSharedAudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    // Do NOT connect to ctx.destination — prevents feedback

    const dataArray = new Uint8Array(analyser.fftSize)
    let smoothedRms = 0
    let rafId: number

    function tick() {
      analyser.getByteTimeDomainData(dataArray)

      // Compute RMS from time-domain data (centered at 128)
      let sumSquares = 0
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128
        sumSquares += normalized * normalized
      }
      const rms = Math.sqrt(sumSquares / dataArray.length)

      // Exponential moving average
      smoothedRms = smoothedRms * 0.7 + rms * 0.3

      // Scale up and clamp to 0-1
      const level = Math.min(smoothedRms * 4, 1)

      // Update CSS variable directly (no React re-render)
      if (elementRef.current) {
        elementRef.current.style.setProperty('--audio-level', level.toFixed(3))
      }

      // Speaking detection with hysteresis
      const nowSpeaking = smoothedRms > threshold

      if (nowSpeaking) {
        // Clear any pending hold timer
        if (holdTimerRef.current !== null) {
          window.clearTimeout(holdTimerRef.current)
          holdTimerRef.current = null
        }
        if (!speakingRef.current) {
          speakingRef.current = true
          setIsSpeaking(true)
        }
      } else if (speakingRef.current && holdTimerRef.current === null) {
        // Start hold timer — keep speaking state for holdDuration after audio drops
        holdTimerRef.current = window.setTimeout(() => {
          speakingRef.current = false
          setIsSpeaking(false)
          holdTimerRef.current = null
        }, holdDuration)
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
      }
      source.disconnect()
      analyser.disconnect()
      speakingRef.current = false
      setIsSpeaking(false)
      if (elementRef.current) {
        elementRef.current.style.setProperty('--audio-level', '0')
      }
    }
  }, [stream, threshold, holdDuration, trackVersion])

  return { isSpeaking }
}
