import { ReactNode } from 'react'
import { X, Minimize2 } from 'lucide-react'

interface ModalProps {
  title: string
  onClose: () => void
  onMinimize?: () => void
  children: ReactNode
  widthClass?: string
}

export default function Modal({ title, onClose, onMinimize, children, widthClass = 'max-w-lg' }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full ${widthClass} max-h-[85vh] overflow-y-auto rounded-3xl bg-white/95 p-6 shadow-apple-lg backdrop-blur-xl dark:bg-racing-900/95`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="flex items-center gap-1.5">
            {onMinimize && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onMinimize()
                }}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
                title="Minimieren"
              >
                <Minimize2 size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
