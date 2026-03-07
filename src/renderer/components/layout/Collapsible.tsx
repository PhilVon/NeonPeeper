import { useState, ReactNode, createContext, useContext } from 'react'
import './Collapsible.css'

interface CollapsibleProps {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
  className?: string
}

interface CollapsibleContextValue {
  isOpen: boolean
  toggle: () => void
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null)

export function Collapsible({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
  className = ''
}: CollapsibleProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isOpen = controlledOpen ?? internalOpen

  const toggle = () => {
    const newState = !isOpen
    if (onOpenChange) {
      onOpenChange(newState)
    } else {
      setInternalOpen(newState)
    }
  }

  return (
    <CollapsibleContext.Provider value={{ isOpen, toggle }}>
      <div className={`collapsible ${isOpen ? 'collapsible-open' : ''} ${className}`.trim()}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

interface CollapsibleTriggerProps {
  children: ReactNode
  className?: string
}

export function CollapsibleTrigger({ children, className = '' }: CollapsibleTriggerProps) {
  const context = useContext(CollapsibleContext)
  if (!context) throw new Error('CollapsibleTrigger must be used within Collapsible')

  const { isOpen, toggle } = context

  return (
    <button
      type="button"
      className={`collapsible-trigger ${className}`.trim()}
      onClick={toggle}
      aria-expanded={isOpen}
    >
      <span className="collapsible-trigger-content">{children}</span>
      <svg className="collapsible-icon" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

interface CollapsibleContentProps {
  children: ReactNode
  className?: string
}

export function CollapsibleContent({ children, className = '' }: CollapsibleContentProps) {
  const context = useContext(CollapsibleContext)
  if (!context) throw new Error('CollapsibleContent must be used within Collapsible')

  const { isOpen } = context

  return (
    <div
      className={`collapsible-content ${isOpen ? 'collapsible-content-open' : ''} ${className}`.trim()}
      aria-hidden={!isOpen}
    >
      <div className="collapsible-content-inner">
        <div className="collapsible-content-padding">
          {children}
        </div>
      </div>
    </div>
  )
}

// Accordion component - only one item open at a time
interface AccordionContextValue {
  openItem: string | null
  setOpenItem: (id: string | null) => void
}

const AccordionContext = createContext<AccordionContextValue | null>(null)

interface AccordionProps {
  defaultOpen?: string
  children: ReactNode
  className?: string
}

export function Accordion({ defaultOpen, children, className = '' }: AccordionProps) {
  const [openItem, setOpenItem] = useState<string | null>(defaultOpen || null)

  return (
    <AccordionContext.Provider value={{ openItem, setOpenItem }}>
      <div className={`accordion ${className}`.trim()}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemProps {
  id: string
  children: ReactNode
  className?: string
}

export function AccordionItem({ id, children, className = '' }: AccordionItemProps) {
  const context = useContext(AccordionContext)
  if (!context) throw new Error('AccordionItem must be used within Accordion')

  const { openItem, setOpenItem } = context
  const isOpen = openItem === id

  const toggle = () => {
    setOpenItem(isOpen ? null : id)
  }

  return (
    <CollapsibleContext.Provider value={{ isOpen, toggle }}>
      <div className={`accordion-item ${isOpen ? 'accordion-item-open' : ''} ${className}`.trim()}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}
