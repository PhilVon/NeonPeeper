import { TextareaHTMLAttributes, forwardRef } from 'react'
import './TextArea.css'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  resize?: 'none' | 'vertical' | 'horizontal' | 'both'
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, resize = 'vertical', className = '', style, ...props }, ref) => {
    const textareaClasses = [
      'neon-textarea',
      error ? 'neon-textarea-error' : '',
      className
    ].filter(Boolean).join(' ')

    return (
      <div className="neon-textarea-wrapper">
        {label && <label className="neon-textarea-label">{label}</label>}
        <textarea
          ref={ref}
          className={textareaClasses}
          style={{ resize, ...style }}
          {...props}
        />
        {error && <span className="neon-textarea-error-text">{error}</span>}
      </div>
    )
  }
)

TextArea.displayName = 'TextArea'
