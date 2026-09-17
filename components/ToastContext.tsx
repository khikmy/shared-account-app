'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface ToastState {
  message: string;
  isError: boolean;
  visible: boolean;
}

const ToastContext = createContext<(message: string, isError?: boolean) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: '', isError: false, visible: false });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, isError = false) => {
    setToast({ message, isError, visible: true });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-lg transition-opacity ${
          toast.visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } ${toast.isError ? 'bg-red-600' : 'bg-neutral-800'}`}
      >
        {toast.message}
      </div>
    </ToastContext.Provider>
  );
}
