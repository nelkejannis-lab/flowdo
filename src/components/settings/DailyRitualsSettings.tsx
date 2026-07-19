import { useTranslation } from 'react-i18next'
import { Sunrise } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'

function RitualToggle({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string
  desc: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-gray-400 dark:text-racing-400">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[#34c759]' : 'bg-gray-200 dark:bg-racing-700'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export default function DailyRitualsSettings() {
  const { t } = useTranslation('settings')
  const ritualWeekPriority = useSettingsStore((s) => s.ritualWeekPriority)
  const ritualDayPriority = useSettingsStore((s) => s.ritualDayPriority)
  const ritualMorningBriefing = useSettingsStore((s) => s.ritualMorningBriefing)
  const ritualEveningWrapUp = useSettingsStore((s) => s.ritualEveningWrapUp)
  const ritualMorgenTop3 = useSettingsStore((s) => s.ritualMorgenTop3)
  const ritualJournal = useSettingsStore((s) => s.ritualJournal)
  const whatsappDailyDigest = useSettingsStore((s) => s.whatsappDailyDigest)
  const whatsappJournalPrompt = useSettingsStore((s) => s.whatsappJournalPrompt)
  const setRitualWeekPriority = useSettingsStore((s) => s.setRitualWeekPriority)
  const setRitualDayPriority = useSettingsStore((s) => s.setRitualDayPriority)
  const setRitualMorningBriefing = useSettingsStore((s) => s.setRitualMorningBriefing)
  const setRitualEveningWrapUp = useSettingsStore((s) => s.setRitualEveningWrapUp)
  const setRitualMorgenTop3 = useSettingsStore((s) => s.setRitualMorgenTop3)
  const setRitualJournal = useSettingsStore((s) => s.setRitualJournal)
  const setWhatsappDailyDigest = useSettingsStore((s) => s.setWhatsappDailyDigest)
  const setWhatsappJournalPrompt = useSettingsStore((s) => s.setWhatsappJournalPrompt)

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <div className="mb-1 flex items-center gap-2">
        <Sunrise size={16} className="text-accent" />
        <h2 className="text-sm font-semibold">{t('rituals.title')}</h2>
      </div>
      <p className="mb-3 text-xs text-gray-400 dark:text-racing-400">{t('rituals.description')}</p>

      <div className="flex flex-col divide-y divide-gray-100 dark:divide-racing-800">
        <RitualToggle
          title={t('rituals.weekPriority')}
          desc={t('rituals.weekPriorityDesc')}
          checked={ritualWeekPriority}
          onChange={setRitualWeekPriority}
        />
        <RitualToggle
          title={t('rituals.dayPriority')}
          desc={t('rituals.dayPriorityDesc')}
          checked={ritualDayPriority}
          onChange={setRitualDayPriority}
        />
        <RitualToggle
          title={t('rituals.morningBriefing')}
          desc={t('rituals.morningBriefingDesc')}
          checked={ritualMorningBriefing}
          onChange={setRitualMorningBriefing}
        />
        <RitualToggle
          title={t('rituals.eveningWrapUp')}
          desc={t('rituals.eveningWrapUpDesc')}
          checked={ritualEveningWrapUp}
          onChange={setRitualEveningWrapUp}
        />
        <RitualToggle
          title={t('rituals.morgenTop3')}
          desc={t('rituals.morgenTop3Desc')}
          checked={ritualMorgenTop3}
          onChange={setRitualMorgenTop3}
        />
        <RitualToggle
          title={t('rituals.journal')}
          desc={t('rituals.journalDesc')}
          checked={ritualJournal}
          onChange={setRitualJournal}
        />
        <RitualToggle
          title={t('rituals.whatsappDigest')}
          desc={t('rituals.whatsappDigestDesc')}
          checked={whatsappDailyDigest}
          onChange={setWhatsappDailyDigest}
        />
        <RitualToggle
          title={t('rituals.whatsappJournal')}
          desc={t('rituals.whatsappJournalDesc')}
          checked={whatsappJournalPrompt}
          onChange={setWhatsappJournalPrompt}
        />
      </div>
    </div>
  )
}
