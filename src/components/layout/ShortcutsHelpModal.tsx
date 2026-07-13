import Modal from './Modal'
import { SHORTCUTS } from '../../hooks/useKeyboardShortcuts'
import { useTranslation } from 'react-i18next'

interface Props {
  onClose: () => void
}

export default function ShortcutsHelpModal({ onClose }: Props) {
  const { i18n } = useTranslation()
  const isEn = i18n.language === 'en'

  return (
    <Modal title={isEn ? 'Keyboard shortcuts' : 'Tastenkürzel'} onClose={onClose}>
      <ul className="flex flex-col gap-2">
        {SHORTCUTS.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-4 text-sm">
            <kbd className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs dark:border-racing-700 dark:bg-racing-800">
              {s.key}
            </kbd>
            <span className="flex-1 text-gray-600 dark:text-racing-200">
              {isEn ? s.descriptionEn : s.descriptionDe}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
