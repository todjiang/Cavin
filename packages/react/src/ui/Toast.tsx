import { useEffect } from 'react'
import { useCavin } from '../context'
import type { ToastMsg } from '../world-store'

const TTL = 2200

function ToastItem({ toast }: { toast: ToastMsg }) {
  const { world: useWorld } = useCavin()
  const dismissToast = useWorld((s) => s.dismissToast)
  useEffect(() => {
    const t = window.setTimeout(() => dismissToast(toast.id), TTL)
    return () => window.clearTimeout(t)
  }, [toast.id, dismissToast])
  return <div className="toast">{toast.text}</div>
}

/** Bottom-center transient messages: lock refusals, saves, deletes, creates. */
export function ToastStack() {
  const { world: useWorld } = useCavin()
  const toasts = useWorld((s) => s.toasts)
  if (toasts.length === 0) return null
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
