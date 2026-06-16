import { X } from 'lucide-react'
import { useToastStore } from '../../store/toastStore'

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="flex items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-racing-700">
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => { toast.action!.onClick(); dismiss(toast.id) }}
              className="font-semibold text-accent hover:text-accent-dark"
            >
              {toast.action.label}
            </button>
          )}
          <button onClick={() => dismiss(toast.id)} className="ml-1 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
