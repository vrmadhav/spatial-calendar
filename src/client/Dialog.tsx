import { useEffect, useRef, type ReactNode } from 'react';

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary, a[href], [tabindex="0"]') ?? []).filter((element) => {
        if (element.hidden || element.closest('[hidden], [inert]')) return false;
        const closedDetails = element.closest('details:not([open])');
        if (closedDetails && element !== closedDetails.querySelector('summary')) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = before; document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={panel}>
      <button className="icon-button dialog-close" aria-label="Close dialog" onClick={onClose}>×</button>
      <h2 id="dialog-title">{title}</h2>{children}
    </div>
  </div>;
}
