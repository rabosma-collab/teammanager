'use client';

import { useRef, useState, useEffect, ReactNode } from 'react';

interface DraggableModalProps {
  onClose?: () => void;
  children: ReactNode;
  /** Extra Tailwind klassen op de container, bijv. breedte: "w-[calc(100vw-2rem)] max-w-md" */
  className?: string;
}

/**
 * Sleepbare modal-wrapper.
 * - Backdrop: semi-transparant (bg-black/40) zodat inhoud erachter zichtbaar blijft
 * - Drag handle bovenaan: klik-en-sleep om de modal te verplaatsen
 * - Begint gecentreerd via CSS; schakelt over naar pixel-positie bij eerste sleep
 */
export default function DraggableModal({ onClose, children, className = '' }: DraggableModalProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragPos = useRef<{ x: number; y: number } | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  // Registreer globale move/end-listeners éénmalig (via refs – geen stale-closure problemen)
  useEffect(() => {
    const onMove = (clientX: number, clientY: number) => {
      if (!isDragging.current || !modalRef.current) return;
      const el = modalRef.current;
      const x = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, clientX - offset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, clientY - offset.current.y));
      dragPos.current = { x, y };
      setPos({ x, y });
    };

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    };
    const onEnd = () => { isDragging.current = false; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  const handleDragStart = (clientX: number, clientY: number) => {
    if (!modalRef.current) return;
    isDragging.current = true;
    if (dragPos.current === null) {
      // Eerste sleep: lees huidige CSS-gecentreerde positie uit
      const rect = modalRef.current.getBoundingClientRect();
      dragPos.current = { x: rect.left, y: rect.top };
      setPos(dragPos.current);
    }
    offset.current = { x: clientX - dragPos.current.x, y: clientY - dragPos.current.y };
  };

  const style = pos
    ? { left: pos.x, top: pos.y, transform: 'none' }
    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <>
      {/* Lichtere backdrop zodat inhoud erachter zichtbaar blijft */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />

      {/* Sleepbare modal-container */}
      <div
        ref={modalRef}
        className={`fixed z-50 bg-gray-800 rounded-xl shadow-2xl overflow-hidden ${className}`}
        style={style}
      >
        {/* Drag handle */}
        <div
          className="flex items-center justify-between px-3 py-1.5 bg-gray-700/60 border-b border-gray-700 cursor-grab active:cursor-grabbing select-none touch-none"
          onMouseDown={(e) => { handleDragStart(e.clientX, e.clientY); e.preventDefault(); }}
          onTouchStart={(e) => { const t = e.touches[0]; handleDragStart(t.clientX, t.clientY); }}
        >
          <span className="text-gray-500 text-base leading-none tracking-widest">⠿ ⠿</span>
          {onClose && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="text-gray-500 hover:text-red-400 text-lg leading-none ml-3 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {children}
      </div>
    </>
  );
}
