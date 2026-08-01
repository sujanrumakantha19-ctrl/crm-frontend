import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  zIndex?: string;
}

const sizeMap = {
  sm: 'max-w-[480px]',
  md: 'max-w-[640px]',
  lg: 'max-w-[800px]',
  xl: 'max-w-[1024px]',
  '2xl': 'max-w-[1280px]',
  '3xl': 'max-w-[1440px]',
  full: 'max-w-[95vw]',
};

export function Modal({ open, onClose, title, size = 'md', children, footer, bodyClassName, zIndex = 'z-[1000]' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={cn('fixed inset-0 flex items-center justify-center p-4 animate-modalIn', zIndex)}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-backdropIn" />
      <div className={cn('relative bg-white rounded-xl shadow-2xl w-full flex flex-col max-h-[90vh]', sizeMap[size])}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-white rounded-t-xl">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        <div className={cn('flex-1 overflow-y-auto p-6 min-h-0', bodyClassName)}>
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
