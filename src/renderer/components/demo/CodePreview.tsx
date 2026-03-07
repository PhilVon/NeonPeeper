import { useState } from 'react'
import './CodePreview.css'

interface CodePreviewProps {
  code: string
  language?: string
}

export function CodePreview({ code, language = 'tsx' }: CodePreviewProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="code-preview">
      <div className="code-preview-header">
        <span className="code-preview-language">{language}</span>
        <button className="code-preview-copy" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="code-preview-content">
        <code>{code}</code>
      </pre>
    </div>
  )
}
