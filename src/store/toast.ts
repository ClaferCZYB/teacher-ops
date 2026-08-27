import { useUIStore } from './useUIStore'

export const toast = {
  success: (title: string, detail?: string) => useUIStore.getState().pushToast({ kind: 'success', title, detail }),
  info: (title: string, detail?: string) => useUIStore.getState().pushToast({ kind: 'info', title, detail }),
  warn: (title: string, detail?: string) => useUIStore.getState().pushToast({ kind: 'warn', title, detail }),
  error: (title: string, detail?: string) => useUIStore.getState().pushToast({ kind: 'error', title, detail }),
}
