import { useEffect, useRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Lock, Unlock, X } from 'lucide-react'

export function IconButton({ label, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" className={'icon-btn ' + className} title={label} aria-label={label} {...props}>{children}</button>
}

export function Slider({ label, value, min = 0, max = 1, step = 0.01, display, hint, locked, onLock, onChange, onCommit, disabled }: {
  label: string; value: number; min?: number; max?: number; step?: number; display?: string; hint?: string
  locked?: boolean; onLock?: () => void; onChange: (value: number) => void; onCommit: () => void; disabled?: boolean
}) {
  return <div className="slider" title={hint}>
    <div className="slider-label">
      <label>{label}<input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        style={{ '--fill': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))} onPointerUp={onCommit} onPointerCancel={onCommit}
        onKeyUp={onCommit} onBlur={onCommit} /></label>
      <span className="quant">{display ?? Math.round(value * 100) + '%'}</span>
      {onLock && <IconButton className="tiny" label={locked ? 'Desbloquear ' + label : 'Bloquear ' + label} aria-pressed={locked}
        onClick={onLock}>{locked ? <Lock size={13} /> : <Unlock size={13} />}</IconButton>}
    </div>
  </div>
}

export function Dialog({ title, description, className = '', onClose, children }: {
  title: string; description?: string; className?: string; onClose: () => void; children: ReactNode
}) {
  const node = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = node.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={node} className={'dialog ' + className} aria-labelledby="dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose() }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-body">
      <header className="dialog-header">
        <div><h2 id="dialog-title">{title}</h2>{description && <p>{description}</p>}</div>
        <IconButton label="Cerrar" onClick={onClose}><X size={18} /></IconButton>
      </header>
      {children}
    </div>
  </dialog>
}

export const toggleIndex = (indices: number[], index: number) =>
  indices.includes(index) ? indices.filter((value) => value !== index) : [...indices, index].sort()
