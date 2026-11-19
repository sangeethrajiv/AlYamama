import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, footer }: {
  title: string; onClose: () => void; children: ReactNode; footer: ReactNode
}) {
  return <div className="modal-backdrop" role="presentation">
    <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={21}/></button></header>
      <div className="modal-content">{children}</div>
      <footer className="modal-footer">{footer}</footer>
    </section>
  </div>
}
