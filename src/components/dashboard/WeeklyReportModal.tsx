import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Loader2, Sparkles } from 'lucide-react'
import Modal from '../layout/Modal'
import { useAiSchedulerStore } from '../../store/aiSchedulerStore'
import { useTasksStore } from '../../store/tasksStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { useTaskTimeStore } from '../../store/taskTimeStore'
import { useBoardsStore } from '../../store/boardsStore'
import { startOfWeek, endOfWeek, format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'

interface WeeklyReportModalProps {
  onClose: () => void
}

export default function WeeklyReportModal({ onClose }: WeeklyReportModalProps) {
  const { t, i18n } = useTranslation('dashboard')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const generateWeekReport = useAiSchedulerStore((s) => s.generateWeekReport)
  const tasks = useTasksStore((s) => s.tasks)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const boards = useBoardsStore((s) => s.boards)
  const entries = useTaskTimeStore((s) => s.entries)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekLabel = `${format(startOfWeek(now, { weekStartsOn: 1 }), 'd. MMM', { locale: dateLocale })} – ${format(endOfWeek(now, { weekStartsOn: 1 }), 'd. MMM yyyy', { locale: dateLocale })}`

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const allTasks = [...tasks, ...myProjectTasks]
      const completed = allTasks.filter((tk) => tk.completed && tk.completedAt && tk.completedAt.slice(0, 10) >= weekStart && tk.completedAt.slice(0, 10) <= weekEnd)
      const open = allTasks.filter((tk) => !tk.completed)
      const overdue = open.filter((tk) => tk.dueDate && tk.dueDate < weekStart)
      const loggedMinutes = entries.filter((e) => e.date >= weekStart && e.date <= weekEnd).reduce((s, e) => s + e.minutes, 0)

      const text = await generateWeekReport({
        weekLabel,
        completed: completed.map((tk) => tk.title),
        open: open.length,
        overdue: overdue.map((tk) => tk.title),
        loggedMinutes,
        boards: boards.map((b) => b.title),
      })
      setReport(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('weekReport.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={t('weekReport.title')} onClose={onClose} widthClass="max-w-lg">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500">{t('weekReport.subtitle', { week: weekLabel })}</p>
        {!report && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? t('weekReport.generating') : t('weekReport.generate')}
          </button>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        {report && (
          <div className="max-h-[50vh] overflow-y-auto rounded-xl bg-gray-50 p-4 text-sm leading-relaxed dark:bg-racing-800 whitespace-pre-wrap">
            {report}
          </div>
        )}
        {report && (
          <button type="button" onClick={() => setReport(null)} className="text-xs text-gray-400 hover:text-gray-600">
            {t('weekReport.regenerate')}
          </button>
        )}
      </div>
    </Modal>
  )
}
