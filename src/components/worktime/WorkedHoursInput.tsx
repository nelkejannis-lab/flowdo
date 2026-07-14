import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatWorkedHoursInput, parseWorkedHoursInput } from '../../utils/worktime'

interface Props {
  netMinutes: number
  targetMinutes?: number
  onCommit: (netMinutes: number) => void
  disabled?: boolean
  className?: string
  compact?: boolean
}

const QUICK_HOURS = [4, 6, 8] as const

export default function WorkedHoursInput({
  netMinutes,
  targetMinutes,
  onCommit,
  disabled,
  className = '',
  compact = false,
}: Props) {
  const { t } = useTranslation('worktime')
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setText(netMinutes > 0 ? formatWorkedHoursInput(netMinutes) : '')
    }
  }, [netMinutes, focused])

  function commit(raw: string) {
    const parsed = parseWorkedHoursInput(raw)
    if (parsed === null) {
      setText(netMinutes > 0 ? formatWorkedHoursInput(netMinutes) : '')
      return
    }
    onCommit(parsed)
    setText(formatWorkedHoursInput(parsed))
  }

  function applyNetMinutes(mins: number) {
    onCommit(mins)
    setText(formatWorkedHoursInput(mins))
  }

  if (disabled) return null

  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={t('week.workedPlaceholder')}
        title={t('week.workedHint')}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          commit(text)
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur()
          }
        }}
        className={`rounded-md border border-gray-200 bg-transparent px-2 py-1 text-right text-sm focus:border-accent focus:outline-none dark:border-racing-700 ${compact ? 'w-full' : 'w-20'}`}
      />
      {focused && (
        <div className="flex flex-wrap justify-end gap-1">
          {QUICK_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyNetMinutes(h * 60)}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 hover:bg-accent hover:text-white dark:bg-racing-800"
            >
              {h}h
            </button>
          ))}
          {targetMinutes != null && targetMinutes > 0 && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyNetMinutes(targetMinutes)}
              className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent hover:bg-accent hover:text-white"
            >
              {t('week.fillTarget')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

