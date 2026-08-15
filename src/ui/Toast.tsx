import { useEffect } from 'react'
import { useWorldStore } from '../store/world'
import type { ToastMsg } from '../store/world'

const TTL = 2200

function ToastItem({ toast }: { toast: ToastMsg }) {
  const dismissToast = useWorldStore((s) => s.dismissToast)
  useEffect(() => {
    const t = window.setTimeout(() => dismissToast(toast.id), TTL)
    return () => window.clearTimeout(t)
  }, [toast.id, dismissToast])
  return <div className="toast">{toast.text}</div>
}

/** Bottom-center transient messages: lock refusals, saves, deletes, creates. */
export function ToastStack() {
  const toasts = useWorldStore((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
