export interface ToastItem {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
}

let nextId = 1

export function useToast() {
  const toasts = useState<ToastItem[]>('ui-toasts', () => [])

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(kind: ToastItem['kind'], message: string) {
    const id = nextId++
    toasts.value = [...toasts.value, { id, kind, message }]
    setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3500)
  }

  return {
    toasts,
    dismiss,
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
  }
}
