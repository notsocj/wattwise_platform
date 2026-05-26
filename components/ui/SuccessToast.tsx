'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';

type SuccessToastPosition = 'bottom-center' | 'top-right';

type SuccessToastProps = {
  message: string | null;
  durationMs?: number;
  position?: SuccessToastPosition;
  onDismiss: () => void;
};

const positionClasses: Record<SuccessToastPosition, string> = {
  'bottom-center':
    'bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-97.5',
  'top-right': 'top-6 right-6 w-[calc(100%-2rem)] max-w-sm',
};

export default function SuccessToast({
  message,
  durationMs = 3500,
  position = 'bottom-center',
  onDismiss,
}: SuccessToastProps) {
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, message, onDismiss]);

  if (!message || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={`fixed z-50 flex items-center gap-2.5 rounded-xl bg-bida/15 border border-bida/30 backdrop-blur-sm px-4 py-3 shadow-lg ${positionClasses[position]}`}
    >
      <CheckCircle2 className="w-4 h-4 text-bida shrink-0" />
      <p className="text-sm font-semibold text-bida">{message}</p>
    </div>,
    document.body
  );
}
