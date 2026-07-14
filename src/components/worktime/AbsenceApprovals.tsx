import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useOrganizationStore } from '../../store/organizationStore'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { Check, X, Clock } from 'lucide-react'

export default function AbsenceApprovals() {
  const { t } = useTranslation('worktime')
  const canApprove = useOrganizationStore((s) => s.canApproveAbsences())
  const fetchTeamAbsences = useWorkTimeStore((s) => s.fetchTeamAbsences)
  const teamAbsences = useWorkTimeStore((s) => s.teamAbsences)
  const reviewAbsence = useWorkTimeStore((s) => s.reviewAbsence)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (canApprove) void fetchTeamAbsences()
  }, [canApprove, fetchTeamAbsences])

  if (!canApprove) return null

  const pending = teamAbsences.filter((a) => a.status === 'pending')

  async function handleReview(id: string, approved: boolean) {
    setBusy(id)
    await reviewAbsence(id, approved)
    setBusy(null)
    void fetchTeamAbsences()
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <div className="mb-3 flex items-center gap-2">
        <Clock size={16} className="text-accent" />
        <h3 className="text-sm font-semibold">{t('absence.approvalsTitle')}</h3>
        {pending.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {pending.length}
          </span>
        )}
      </div>
      {pending.length === 0 ? (
        <p className="text-xs text-gray-400">{t('absence.noPending')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-racing-800">
              <div className="min-w-0 text-xs">
                <p className="font-medium">{p.profile?.display_name ?? '—'}</p>
                <p className="text-gray-500">
                  {p.startDate} – {p.endDate} · {t(`absence.types.${p.type}`)}
                  {p.note ? ` · ${p.note}` : ''}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => handleReview(p.id, true)}
                  className="rounded-lg bg-green-500/10 p-1.5 text-green-600 hover:bg-green-500/20"
                  title={t('absence.approve')}
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => handleReview(p.id, false)}
                  className="rounded-lg bg-red-500/10 p-1.5 text-red-600 hover:bg-red-500/20"
                  title={t('absence.reject')}
                >
                  <X size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
