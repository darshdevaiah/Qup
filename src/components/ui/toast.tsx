"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { generateId } from "@/lib/generate-id";

export type ToastVariant = "success" | "duplicate" | "error";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 2000;

const variantStyles: Record<ToastVariant, string> = {
  success:
    "border-violet-500/40 bg-zinc-900/90 shadow-violet-500/10",
  duplicate:
    "border-fuchsia-500/35 bg-zinc-900/90 shadow-fuchsia-500/10",
  error:
    "border-red-500/40 bg-zinc-900/90 shadow-red-500/10 text-red-100",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = generateId();
      setToasts((prev) => [...prev, { id, message, variant }]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, TOAST_DURATION_MS);
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-8"
          >
            {toasts.map((toast) => (
              <div
                key={toast.id}
                role="status"
                className={`toast-enter pointer-events-auto max-w-sm rounded-2xl border px-4 py-3 text-center text-sm font-medium text-white shadow-lg backdrop-blur-md ${variantStyles[toast.variant]}`}
              >
                {toast.message}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
