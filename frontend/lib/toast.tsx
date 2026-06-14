"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

export type ToastType = "success" | "error" | "info"

interface Toast {
  id:      number
  message: string
  type:    ToastType
}

interface ToastContextValue {
  toasts:  Toast[]
  success: (msg: string) => void
  error:   (msg: string) => void
  info:    (msg: string) => void
  remove:  (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let _id = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((message: string, type: ToastType) => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{
      toasts,
      success: (msg) => add(msg, "success"),
      error:   (msg) => add(msg, "error"),
      info:    (msg) => add(msg, "info"),
      remove,
    }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used inside ToastProvider")
  return ctx
}