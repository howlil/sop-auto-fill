/**
 * UI store - Zustand
 * Store untuk UI state global (toast, sidebar, modals)
 */

import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  message: string
  type: ToastType
  id: string
}

interface UIState {
  toasts: Toast[]
  sidebarOpen: boolean
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
  setSidebarOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  sidebarOpen: true,

  addToast: (message, type = 'info') => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { message, type, id }] }))
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))

