import { useState, useRef, useCallback, useEffect } from 'react'
import { Modal, ModalFooter } from './Modal'
import { NeonButton } from './NeonButton'
import { Slider } from './Slider'
import './ImageEditor.css'

interface ImageEditorProps {
  isOpen: boolean
  onClose: () => void
  onSave: (dataUrl: string) => void
  mode: 'avatar' | 'emoji'
  title?: string
  initialImage?: string
}

const SIZES = { avatar: 96, emoji: 48 } as const
const MAX_BASE64_LEN = { avatar: 20_000, emoji: 7_000 } as const
const CANVAS_SIZE = 320

export function ImageEditor({
  isOpen,
  onClose,
  onSave,
  mode,
  title,
  initialImage,
}: ImageEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [outputDataUrl, setOutputDataUrl] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const targetSize = SIZES[mode]
  const maxLen = MAX_BASE64_LEN[mode]

  // Load initial image
  useEffect(() => {
    if (isOpen && initialImage) {
      const img = new Image()
      img.onload = () => {
        setImage(img)
        resetTransform(img)
      }
      img.src = initialImage
    }
    if (!isOpen) {
      setImage(null)
      setZoom(1)
      setOffsetX(0)
      setOffsetY(0)
      setBrightness(100)
      setContrast(100)
      setOutputDataUrl('')
    }
  }, [isOpen, initialImage])

  const resetTransform = (img: HTMLImageElement) => {
    const scale = CANVAS_SIZE / Math.min(img.width, img.height)
    setZoom(scale)
    setOffsetX((CANVAS_SIZE - img.width * scale) / 2)
    setOffsetY((CANVAS_SIZE - img.height * scale) / 2)
  }

  const drawCanvas = useCallback(() => {
    if (!image) return

    const canvas = canvasRef.current
    const preview = previewRef.current
    if (!canvas || !preview) return

    // Main canvas
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`
    ctx.drawImage(image, offsetX, offsetY, image.width * zoom, image.height * zoom)
    ctx.filter = 'none'

    // Preview canvas
    const pCtx = preview.getContext('2d')!
    pCtx.clearRect(0, 0, targetSize, targetSize)
    pCtx.filter = `brightness(${brightness}%) contrast(${contrast}%)`
    pCtx.drawImage(
      image,
      offsetX / zoom, offsetY / zoom,
      CANVAS_SIZE / zoom, CANVAS_SIZE / zoom,
      0, 0,
      targetSize, targetSize
    )
    pCtx.filter = 'none'

    // Generate output
    generateOutput(pCtx, preview)
  }, [image, zoom, offsetX, offsetY, brightness, contrast, targetSize])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  const generateOutput = (_ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Try PNG first
    let dataUrl = canvas.toDataURL('image/png')
    if (dataUrl.length > maxLen) {
      // Fall back to WebP
      dataUrl = canvas.toDataURL('image/webp', 0.8)
    }
    setOutputDataUrl(dataUrl)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        setImage(img)
        resetTransform(img)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!image) return
    setDragging(true)
    setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setOffsetX(e.clientX - dragStart.x)
    setOffsetY(e.clientY - dragStart.y)
  }

  const handleMouseUp = () => {
    setDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (!image) return
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    setZoom((z) => Math.max(0.1, Math.min(5, z + delta)))
  }

  const handleSave = () => {
    if (outputDataUrl) {
      onSave(outputDataUrl)
      onClose()
    }
  }

  const isTooLarge = outputDataUrl.length > maxLen

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || (mode === 'avatar' ? 'Edit Avatar' : 'Edit Emoji')}
      size="large"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {!image ? (
        <div
          className="image-editor-drop-zone"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="image-editor-drop-zone-icon">+</div>
          <div className="image-editor-drop-zone-text">
            Click to select an image
          </div>
        </div>
      ) : (
        <div className="image-editor-workspace">
          <div className="image-editor-canvas-area">
            <div
              className="image-editor-canvas-wrapper"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
              />
            </div>
            <div className="image-editor-preview-section">
              <span className="image-editor-preview-label">
                Preview ({targetSize}x{targetSize})
              </span>
              <canvas
                ref={previewRef}
                className="image-editor-preview-canvas"
                width={targetSize}
                height={targetSize}
              />
              {outputDataUrl && (
                <span className={`image-editor-size-info${isTooLarge ? ' image-editor-size-warning' : ''}`}>
                  {Math.round(outputDataUrl.length / 1024 * 10) / 10}KB
                  {isTooLarge && ' (too large)'}
                </span>
              )}
            </div>
          </div>

          <div className="image-editor-controls">
            <Slider
              label="Zoom"
              min={10}
              max={500}
              value={Math.round(zoom * 100)}
              onChange={(e) => setZoom(Number((e.target as HTMLInputElement).value) / 100)}
              showValue
              color="cyan"
            />
            <Slider
              label="Brightness"
              min={0}
              max={200}
              value={brightness}
              onChange={(e) => setBrightness(Number((e.target as HTMLInputElement).value))}
              showValue
              color="green"
            />
            <Slider
              label="Contrast"
              min={0}
              max={200}
              value={contrast}
              onChange={(e) => setContrast(Number((e.target as HTMLInputElement).value))}
              showValue
              color="magenta"
            />
          </div>

          <NeonButton
            size="small"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Change Image
          </NeonButton>
        </div>
      )}

      <ModalFooter>
        <NeonButton variant="secondary" onClick={onClose}>
          Cancel
        </NeonButton>
        <NeonButton
          onClick={handleSave}
          disabled={!outputDataUrl || isTooLarge}
        >
          Save
        </NeonButton>
      </ModalFooter>
    </Modal>
  )
}
