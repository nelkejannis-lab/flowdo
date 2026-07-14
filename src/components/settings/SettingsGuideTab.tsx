import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, ListTodo, CalendarDays, Clock, Sparkles, Trello,
  MessageCircle, Users, Brain, Grid2x2, Mic, Keyboard, Shield, ArrowRight,
} from 'lucide-react'

const GUIDE_SECTIONS = [
  { key: 'dashboard', icon: LayoutDashboard, to: '/', color: 'text-blue-500' },
  { key: 'tasks', icon: ListTodo, to: '/tasks', color: 'text-green-500' },
  { key: 'projects', icon: Trello, to: '/projekte', color: 'text-purple-500' },
  { key: 'calendar', icon: CalendarDays, to: '/calendar', color: 'text-orange-500' },
  { key: 'worktime', icon: Clock, to: '/arbeitszeit', color: 'text-cyan-500' },
  { key: 'ai', icon: Sparkles, to: '/ki-termine', color: 'text-violet-500' },
  { key: 'brain', icon: Brain, to: '/gehirn', color: 'text-amber-500' },
  { key: 'eisenhower', icon: Grid2x2, to: '/eisenhower', color: 'text-pink-500' },
  { key: 'team', icon: Users, to: '/friends', color: 'text-indigo-500' },
  { key: 'chat', icon: MessageCircle, to: '/chat', color: 'text-teal-500' },
  { key: 'meetings', icon: Mic, to: '/meetings', color: 'text-rose-500' },
] as const

export default function SettingsGuideTab() {
  const { t } = useTranslation('settings')

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 dark:border-accent/30">
        <h2 className="text-base font-semibold">{t('guide.title')}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('guide.intro')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {GUIDE_SECTIONS.map(({ key, icon: Icon, to, color }) => (
          <Link
            key={key}
            to={to}
            className="group flex gap-3 rounded-xl border border-gray-100 bg-white p-4 transition-colors hover:border-accent/30 hover:bg-accent/5 dark:border-racing-800 dark:bg-racing-900 dark:hover:border-accent/30"
          >
            <div className={`mt-0.5 flex-shrink-0 ${color}`}>
              <Icon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <h3 className="text-sm font-semibold">{t(`guide.sections.${key}.title`)}</h3>
                <ArrowRight size={12} className="opacity-0 transition-opacity group-hover:opacity-60" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {t(`guide.sections.${key}.desc`)}
              </p>
              {t(`guide.sections.${key}.tip`, { defaultValue: '' }) && (
                <p className="mt-2 rounded-lg bg-gray-50 px-2 py-1 text-[11px] text-gray-600 dark:bg-racing-800 dark:text-gray-300">
                  💡 {t(`guide.sections.${key}.tip`)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <div className="mb-2 flex items-center gap-2">
          <Keyboard size={16} className="text-accent" />
          <h3 className="text-sm font-semibold">{t('guide.shortcutsTitle')}</h3>
        </div>
        <p className="text-xs text-gray-500">{t('guide.shortcutsDesc')}</p>
        <Link to="/einstellungen?tab=tastenkuerzel" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
          {t('guide.shortcutsLink')} →
        </Link>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <div className="mb-2 flex items-center gap-2">
          <Shield size={16} className="text-accent" />
          <h3 className="text-sm font-semibold">{t('guide.privacyTitle')}</h3>
        </div>
        <p className="text-xs text-gray-500">{t('guide.privacyDesc')}</p>
        <Link to="/einstellungen?tab=datenschutz" className="mt-2 inline-block text-xs font-medium text-accent hover:underline">
          {t('guide.privacyLink')} →
        </Link>
      </div>
    </div>
  )
}
