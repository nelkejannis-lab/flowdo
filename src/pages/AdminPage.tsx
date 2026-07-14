import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import {
  Building2, Users, UserPlus, Shield, BarChart3, Loader2, Trash2,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useOrganizationStore } from '../store/organizationStore'
import { useTeamsStore } from '../store/teamsStore'
import { useWorkTimeStore } from '../store/workTimeStore'
import { useBoardsStore } from '../store/boardsStore'
import { useTaskTimeStore } from '../store/taskTimeStore'
import AbsenceApprovals from '../components/worktime/AbsenceApprovals'
import type { OrgRole } from '../types'

const ROLES: OrgRole[] = ['member', 'manager', 'admin']

export default function AdminPage() {
  const { t } = useTranslation('admin')
  const profile = useAuthStore((s) => s.profile)
  const organization = useOrganizationStore((s) => s.organization)
  const members = useOrganizationStore((s) => s.members)
  const myRole = useOrganizationStore((s) => s.myRole)
  const loading = useOrganizationStore((s) => s.loading)
  const fetchOrg = useOrganizationStore((s) => s.fetch)
  const createOrg = useOrganizationStore((s) => s.create)
  const inviteMember = useOrganizationStore((s) => s.inviteMember)
  const updateMemberRole = useOrganizationStore((s) => s.updateMemberRole)
  const removeMember = useOrganizationStore((s) => s.removeMember)
  const searchProfiles = useOrganizationStore((s) => s.searchProfiles)
  const canManage = useOrganizationStore((s) => s.canManage)
  const teams = useTeamsStore((s) => s.teams)
  const fetchTeams = useTeamsStore((s) => s.fetch)
  const teamAbsences = useWorkTimeStore((s) => s.teamAbsences)
  const fetchTeamAbsences = useWorkTimeStore((s) => s.fetchTeamAbsences)
  const boards = useBoardsStore((s) => s.boards)
  const timeEntries = useTaskTimeStore((s) => s.entries)

  const [orgName, setOrgName] = useState('')
  const [inviteQuery, setInviteQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; display_name: string; username: string }[]>([])
  const [inviteRole, setInviteRole] = useState<OrgRole>('member')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const hasAccess = profile?.is_admin || myRole === 'owner' || myRole === 'admin' || myRole === 'manager'

  useEffect(() => {
    void fetchOrg()
    void fetchTeams()
    void fetchTeamAbsences()
  }, [fetchOrg, fetchTeams, fetchTeamAbsences])

  useEffect(() => {
    if (!inviteQuery.trim() || inviteQuery.length < 2) {
      setSearchResults([])
      return
    }
    const tmr = setTimeout(() => {
      void searchProfiles(inviteQuery).then(setSearchResults)
    }, 300)
    return () => clearTimeout(tmr)
  }, [inviteQuery, searchProfiles])

  if (!profile) return null
  if (!hasAccess && !profile.is_admin) return <Navigate to="/" replace />

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await createOrg(orgName)
    if (err) setError(err)
    setBusy(false)
  }

  async function handleInvite(userId: string) {
    setError(null)
    const err = await inviteMember(userId, inviteRole)
    if (err) setError(err)
    else {
      setInviteQuery('')
      setSearchResults([])
    }
  }

  const pendingAbsences = teamAbsences.filter((a) => a.status === 'pending').length
  const totalMembers = members.length
  const activeProjects = boards.length
  const totalTrackedMinutes = timeEntries.reduce((sum, e) => sum + e.minutes, 0)

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-400">
        <Loader2 className="animate-spin" size={24} />
      </div>
    )
  }

  if (!organization && canManage()) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-racing-800 dark:bg-racing-900">
          <Building2 size={32} className="mb-4 text-accent" />
          <h1 className="text-xl font-bold">{t('createOrg.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('createOrg.desc')}</p>
          <form onSubmit={handleCreateOrg} className="mt-4 flex flex-col gap-3">
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={t('createOrg.placeholder')}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-racing-700"
              required
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={busy} className="rounded-xl bg-accent py-2.5 text-sm font-semibold text-white">
              {busy ? t('createOrg.creating') : t('createOrg.submit')}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (!organization) return <Navigate to="/" replace />

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-gray-500">{organization.name} · {t(`roles.${myRole ?? 'member'}`)}</p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('stats.members'), value: totalMembers, icon: Users },
          { label: t('stats.teams'), value: teams.length, icon: Building2 },
          { label: t('stats.projects'), value: activeProjects, icon: BarChart3 },
          { label: t('stats.pendingAbsences'), value: pendingAbsences, icon: Shield },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <div className="flex items-center gap-2 text-gray-400">
              <Icon size={14} />
              <span className="text-xs">{label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {canManage() && (
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">{t('invite.title')}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={inviteQuery}
              onChange={(e) => setInviteQuery(e.target.value)}
              placeholder={t('invite.placeholder')}
              className="min-w-[200px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{t(`roles.${r}`)}</option>
              ))}
            </select>
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          {searchResults.length > 0 && (
            <ul className="mt-2 rounded-lg border border-gray-100 dark:border-racing-800">
              {searchResults.map((u) => (
                <li key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{u.display_name} <span className="text-gray-400">@{u.username}</span></span>
                  <button type="button" onClick={() => handleInvite(u.id)} className="text-xs font-semibold text-accent">
                    {t('invite.add')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <h2 className="mb-3 text-sm font-semibold">{t('members.title')}</h2>
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.profile.display_name}</p>
                  <p className="text-xs text-gray-400">@{m.profile.username}</p>
                </div>
                {canManage() && m.role !== 'owner' ? (
                  <div className="flex items-center gap-1">
                    <select
                      value={m.role}
                      onChange={(e) => void updateMemberRole(m.userId, e.target.value as OrgRole)}
                      className="rounded border border-gray-200 bg-transparent px-2 py-1 text-xs dark:border-racing-700"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => void removeMember(m.userId)}
                      className="rounded p-1 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">{t(`roles.${m.role}`)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <AbsenceApprovals />
          <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <h2 className="mb-2 text-sm font-semibold">{t('reports.title')}</h2>
            <p className="text-xs text-gray-500">{t('reports.trackedHours', { hours: (totalTrackedMinutes / 60).toFixed(1) })}</p>
            <p className="mt-1 text-xs text-gray-500">{t('reports.teamsCount', { count: teams.length })}</p>
            <p className="mt-3 text-[11px] text-gray-400">{t('reports.hint')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
