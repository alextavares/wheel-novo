"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  message: string;
  kind?: ToastKind;
  durationMs?: number;
};

type ToastContextValue = {
  show: (message: string, options?: { kind?: ToastKind; durationMs?: number }) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
  warning: (message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, options?: { kind?: ToastKind; durationMs?: number }) => {
      const id = uid();
      const toast: Toast = {
        id,
        message,
        kind: options?.kind || "info",
        durationMs: options?.durationMs ?? 2500,
      };
      setToasts((prev) => [...prev, toast]);
      if (toast.durationMs && toast.durationMs > 0) {
        window.setTimeout(() => remove(id), toast.durationMs);
      }
    },
    [remove]
  );

  const api = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (msg, dur) => show(msg, { kind: "success", durationMs: dur }),
      error: (msg, dur) => show(msg, { kind: "error", durationMs: dur }),
      info: (msg, dur) => show(msg, { kind: "info", durationMs: dur }),
      warning: (msg, dur) => show(msg, { kind: "warning", durationMs: dur }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Container fixo no topo/direita */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 top-3 z-[1000] flex flex-col items-center gap-2 px-3 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={[
              "pointer-events-auto w-full max-w-sm rounded-md border px-4 py-3 text-sm shadow-md transition",
              t.kind === "success" ? "bg-green-50 border-green-200 text-green-900" : "",
              t.kind === "error" ? "bg-red-50 border-red-200 text-red-900" : "",
              t.kind === "info" ? "bg-blue-50 border-blue-200 text-blue-900" : "",
              t.kind === "warning" ? "bg-yellow-50 border-yellow-200 text-yellow-900" : "",
            ].join(" ")}
          >
            <div className="flex items-start gap-2">
              <span className="flex-1">{t.message}</span>
              <button
                className="ml-2 rounded p-1 text-gray-600 hover:bg-black/5"
                aria-label="Fechar notificação"
                onClick={() => remove(t.id)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de <ToastProvider>");
  return ctx;
}