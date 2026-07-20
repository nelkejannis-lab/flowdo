import { useCallback } from 'react'
import PriorityPlanModal from './PriorityPlanModal'
import { usePriorityPlanStore, weekKey } from '../../store/priorityPlanStore'
import { useSettingsStore } from '../../store/settingsStore'
import { todayISO } from '../../utils/date'

/**
 * Renders priority modal at app shell level so Dashboard re-renders (work timer, task sync)
 * cannot reset in-modal reorder state.
 */
export default function PriorityPlanModalHost() {
  const draft = usePriorityPlanStore((s) => s.modalDraft)
  const closePriorityModal = usePriorityPlanStore((s) => s.closePriorityModal)
  const setDayOrder = usePriorityPlanStore((s) => s.setDayOrder)
  const setWeekOrder = usePriorityPlanStore((s) => s.setWeekOrder)
  const confirmDay = usePriorityPlanStore((s) => s.confirmDay)
  const confirmWeek = usePriorityPlanStore((s) => s.confirmWeek)
  const dayConfirmed = usePriorityPlanStore((s) => s.dayConfirmed)
  const ritualDayPriority = useSettingsStore((s) => s.ritualDayPriority)
  const ritualMorningBriefing = useSettingsStore((s) => s.ritualMorningBriefing)

  const openDayAfterWeek = useCallback(() => {
    const today = todayISO()
    if (ritualDayPriority && !dayConfirmed[today]) {
      window.dispatchEvent(new CustomEvent('novat:open-day-priority'))
    } else if (ritualMorningBriefing && localStorage.getItem('morningReportDismissed') !== today) {
      window.dispatchEvent(new CustomEvent('novat:open-morning-report'))
    }
  }, [ritualDayPriority, ritualMorningBriefing, dayConfirmed])

  if (!draft) return null

  const handleClose = () => {
    if (draft.mode === 'week') {
      localStorage.setItem('weekPrioritySkipped', weekKey())
    } else {
      localStorage.setItem('dayPrioritySkipped', todayISO())
    }
    closePriorityModal()
  }

  const handleSkip = () => {
    handleClose()
    if (draft.mode === 'week') openDayAfterWeek()
    else if (ritualMorningBriefing && localStorage.getItem('morningReportDismissed') !== todayISO()) {
      window.dispatchEvent(new CustomEvent('novat:open-morning-report'))
    }
  }

  const handleSave = (ids: string[]) => {
    if (draft.mode === 'week') {
      const wk = weekKey()
      setWeekOrder(wk, ids)
      confirmWeek(wk)
      closePriorityModal()
      openDayAfterWeek()
      return
    }
    const today = todayISO()
    setDayOrder(today, ids)
    confirmDay(today)
    closePriorityModal()
    if (ritualMorningBriefing && localStorage.getItem('morningReportDismissed') !== today) {
      window.dispatchEvent(new CustomEvent('novat:open-morning-report'))
    }
  }

  return (
    <PriorityPlanModal
      onSave={handleSave}
      onClose={handleClose}
      onSkip={handleSkip}
    />
  )
}
