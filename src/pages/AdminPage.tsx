import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import {
  Building2, Users, UserPlus, Shield, BarChart3, Loader2, Trash2, Layers, Globe,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useOrganizationStore } from '../store/organizationStore'
import { useDepartmentStore } from '../store/departmentStore'
import { useTeamsStore } from '../store/teamsStore'
import { useWorkTimeStore } from '../store/workTimeStore'
import { useBoardsStore } from '../store/boardsStore'
import { useTaskTimeStore } from '../store/taskTimeStore'
import AbsenceApprovals from '../components/worktime/AbsenceApprovals'
import UserAvatar from '../components/shared/UserAvatar'
import type { AppRole, OrgRole } from '../types'
import {
  APP_ROLE_LABELS,
  ORG_ROLE_LABELS,
  assignableOrgRoles,
  canAccessOrgAdminPanel,
  canManageDepartments,
  canManageOrg,
  canManageTeams,
  isSuperAdmin,
} from '../lib/roles'

type InviteCandidate = { id: string; display_name: string; username: string; avatar_color?: string }

type AdminTab = 'overview' | 'members' | 'departments' | 'teams' | 'global'
const ORG_ROLES: OrgRole[] = ['member', 'manager', 'admin', 'owner']

function RoleHint({ type, role, lang }: { type: 'app' | 'org'; role: string; lang: 'de' | 'en' }) {
  const labels = type === 'app' ? APP_ROLE_LABELS[role as AppRole] : ORG_ROLE_LABELS[role as OrgRole]
  if (!labels) return null
  return (
    <p className="mt-0.5 text-[10px] text-gray-400">{lang === 'en' ? labels.descEn : labels.descDe}</p>
  )
}

export default function AdminPage() {
  const { t, i18n } = useTranslation('admin')
  const lang = i18n.language === 'en' ? 'en' : 'de'
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
  const setAppRole = useOrganizationStore((s) => s.setAppRole)
  const setOrgRole = useOrganizationStore((s) => s.setOrgRole)
  const departments = useDepartmentStore((s) => s.departments)
  const fetchDepartments = useDepartmentStore((s) => s.fetch)
  const createDepartment = useDepartmentStore((s) => s.create)
  const removeDepartment = useDepartmentStore((s) => s.remove)
  const assignOrgMemberDepartment = useDepartmentStore((s) => s.assignOrgMemberDepartment)
  const teams = useTeamsStore((s) => s.teams)
  const fetchTeams = useTeamsStore((s) => s.fetch)
  const createTeam = useTeamsStore((s) => s.create)
  const removeTeam = useTeamsStore((s) => s.remove)
  const fetchTeamAbsences = useWorkTimeStore((s) => s.fetchTeamAbsences)
  const teamAbsences = useWorkTimeStore((s) => s.teamAbsences)
  const boards = useBoardsStore((s) => s.boards)
  const timeEntries = useTaskTimeStore((s) => s.entries)

  const [tab, setTab] = useState<AdminTab>('overview')
  const [orgName, setOrgName] = useState('')
  const [inviteQuery, setInviteQuery] = useState('')
  const [searchResults, setSearchResults] = useState<InviteCandidate[]>([])
  const [selectedInviteUser, setSelectedInviteUser] = useState<InviteCandidate | null>(null)
  const [showInviteSuggestions, setShowInviteSuggestions] = useState(false)
  const [inviteSearching, setInviteSearching] = useState(false)
  const inviteSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [inviteRole, setInviteRole] = useState<OrgRole>('member')
  const [inviteDept, setInviteDept] = useState('')
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalResults, setGlobalResults] = useState<any[]>([])
  const [deptName, setDeptName] = useState('')
  const [deptDesc, setDeptDesc] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teamDept, setTeamDept] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  const superAdmin = isSuperAdmin(profile)
  const hasAccess = canAccessOrgAdminPanel(profile, myRole)
  const inviteRoles = assignableOrgRoles(myRole)

  useEffect(() => {
    void fetchOrg()
  }, [fetchOrg])

  useEffect(() => {
    if (organization) {
      void fetchDepartments(organization.id)
      void fetchTeams(organization.id)
      void fetchTeamAbsences()
    }
  }, [organization, fetchDepartments, fetchTeams, fetchTeamAbsences])

  useEffect(() => {
    if (inviteSearchTimeout.current) clearTimeout(inviteSearchTimeout.current)
    if (!inviteQuery.trim() || inviteQuery.length < 2) {
      setSearchResults([])
      setInviteSearching(false)
      return
    }
    if (selectedInviteUser && inviteQuery === `${selectedInviteUser.display_name} (@${selectedInviteUser.username})`) {
      setSearchResults([])
      setInviteSearching(false)
      return
    }
    setInviteSearching(true)
    inviteSearchTimeout.current = setTimeout(() => {
      void searchProfiles(inviteQuery, organization?.id).then((results) => {
        setSearchResults(results)
        setInviteSearching(false)
      })
    }, 300)
    return () => {
      if (inviteSearchTimeout.current) clearTimeout(inviteSearchTimeout.current)
    }
  }, [inviteQuery, searchProfiles, organization?.id, selectedInviteUser])

  useEffect(() => {
    if (!globalQuery.trim() || globalQuery.length < 2) { setGlobalResults([]); return }
    const tmr = setTimeout(() => { void searchProfiles(globalQuery).then(setGlobalResults) }, 300)
    return () => clearTimeout(tmr)
  }, [globalQuery, searchProfiles])

  if (!profile) return null
  if (!hasAccess) return <Navigate to="/" replace />

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const err = await createOrg(orgName)
    if (err) setError(err)
    setBusy(false)
  }

  function selectInviteCandidate(user: InviteCandidate) {
    setSelectedInviteUser(user)
    setInviteQuery(`${user.display_name} (@${user.username})`)
    setSearchResults([])
    setShowInviteSuggestions(false)
  }

  function handleInviteQueryChange(value: string) {
    setInviteQuery(value)
    if (selectedInviteUser && value !== `${selectedInviteUser.display_name} (@${selectedInviteUser.username})`) {
      setSelectedInviteUser(null)
    }
  }

  async function handleInvite(userId?: string) {
    const targetId = userId ?? selectedInviteUser?.id
    if (!targetId) return
    setError(null)
    const err = await inviteMember(targetId, inviteRole, inviteDept || undefined)
    if (err) setError(err)
    else {
      setInviteQuery('')
      setSearchResults([])
      setSelectedInviteUser(null)
    }
  }

  async function handleAssignDept(userId: string, departmentId: string) {
    if (!organization) return
    const err = await assignOrgMemberDepartment(organization.id, userId, departmentId || null)
    if (err) setError(err)
    else await fetchOrg()
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-gray-400">
        <Loader2 className="animate-spin" size={24} />
      </div>
    )
  }

  if (!organization && canManageOrg(profile, myRole)) {
    return (
      <div className="mx-auto max-w-md p-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-racing-800 dark:bg-racing-900">
          <Building2 size={32} className="mb-4 text-accent" />
          <h1 className="text-xl font-bold">{t('createOrg.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">{t('createOrg.desc')}</p>
          {superAdmin && (
            <p className="mt-2 text-xs text-accent">{t('global.desc')}</p>
          )}
          <form onSubmit={handleCreateOrg} className="mt-4 flex flex-col gap-3">
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder={t('createOrg.placeholder')}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" required />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={busy} className="rounded-xl bg-accent py-2.5 text-sm font-semibold text-white">
              {busy ? t('createOrg.creating') : t('createOrg.submit')}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (!organization && superAdmin) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-500">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {t('roles.appAdmin')}
            </span>
          </p>
        </div>
        <div className="mb-6 rounded-xl border border-accent/20 bg-accent/5 p-4">
          <h2 className="text-sm font-semibold">{t('createOrg.title')}</h2>
          <p className="mt-1 text-xs text-gray-500">{t('createOrg.desc')}</p>
          <form onSubmit={handleCreateOrg} className="mt-3 flex gap-2">
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder={t('createOrg.placeholder')}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" required />
            <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">
              {busy ? t('createOrg.creating') : t('createOrg.submit')}
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <h2 className="mb-2 text-sm font-semibold">{t('global.title')}</h2>
          <p className="mb-3 text-xs text-gray-500">{t('global.desc')}</p>
          <input value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)} placeholder={t('global.searchPlaceholder')}
            className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" />
          {globalResults.map((u) => (
            <div key={u.id} className="mb-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800">
              <p className="text-sm font-medium">{u.display_name} <span className="text-gray-400">@{u.username}</span></p>
              <select defaultValue={u.app_role === 'admin' ? 'admin' : 'user'}
                onChange={async (e) => {
                  const err = await setAppRole(u.id, e.target.value as AppRole)
                  if (err) setError(err)
                }}
                className="mt-1 rounded border border-gray-200 px-2 py-1 text-xs dark:border-racing-700">
                <option value="user">{t('roles.appUser')}</option>
                <option value="admin">{t('roles.appAdmin')}</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!organization && !superAdmin) return <Navigate to="/" replace />

  const pendingAbsences = teamAbsences.filter((a) => a.status === 'pending').length
  const totalTrackedMinutes = timeEntries.reduce((sum, e) => sum + e.minutes, 0)
  const tabs: { id: AdminTab; label: string; icon: typeof Users; show?: boolean }[] = [
    { id: 'overview', label: t('tabs.overview'), icon: BarChart3, show: !!organization },
    { id: 'members', label: t('tabs.members'), icon: Users, show: !!organization && canManageOrg(profile, myRole) },
    { id: 'departments', label: t('tabs.departments'), icon: Layers, show: !!organization && canManageDepartments(profile, myRole) },
    { id: 'teams', label: t('tabs.teams'), icon: Building2, show: !!organization && canManageTeams(profile, myRole) },
    { id: 'global', label: t('tabs.global'), icon: Globe, show: superAdmin },
  ]

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {organization && (
          <p className="text-sm text-gray-500">
            {organization.name}
            {myRole && ` · ${t(`roles.${myRole}`)}`}
            {superAdmin && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {t('roles.appAdmin')}
              </span>
            )}
          </p>
        )}
        {!organization && superAdmin && (
          <p className="text-sm text-gray-500">{t('global.desc')}</p>
        )}
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-gray-200 p-1 dark:border-racing-700">
        {tabs.filter((tb) => tb.show !== false).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === id ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
      {saved && <p className="mb-4 text-sm text-emerald-500">{t('global.saved')}</p>}

      {tab === 'overview' && organization && (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t('stats.members'), value: members.length, icon: Users },
              { label: t('stats.departments'), value: departments.length, icon: Layers },
              { label: t('stats.teams'), value: teams.length, icon: Building2 },
              { label: t('stats.pendingAbsences'), value: pendingAbsences, icon: Shield },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
                <div className="flex items-center gap-2 text-gray-400"><Icon size={14} /><span className="text-xs">{label}</span></div>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <AbsenceApprovals />
            <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
              <h2 className="mb-2 text-sm font-semibold">{t('reports.title')}</h2>
              <p className="text-xs text-gray-500">{t('reports.trackedHours', { hours: (totalTrackedMinutes / 60).toFixed(1) })}</p>
              <p className="mt-1 text-xs text-gray-500">{t('stats.projects')}: {boards.length}</p>
            </div>
          </div>
        </>
      )}

      {tab === 'members' && organization && canManageOrg(profile, myRole) && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <div className="mb-3 flex items-center gap-2"><UserPlus size={16} className="text-accent" /><h2 className="text-sm font-semibold">{t('invite.title')}</h2></div>
            <div className="flex flex-wrap items-start gap-2">
              <div className="relative min-w-[200px] flex-1">
                <input
                  value={inviteQuery}
                  onChange={(e) => handleInviteQueryChange(e.target.value)}
                  onFocus={() => setShowInviteSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowInviteSuggestions(false), 150)}
                  placeholder={t('invite.placeholder')}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
                {showInviteSuggestions && inviteQuery.trim().length >= 2 && !selectedInviteUser && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-racing-700 dark:bg-racing-900">
                    {inviteSearching ? (
                      <p className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
                        <Loader2 size={12} className="animate-spin" /> {t('invite.searching')}
                      </p>
                    ) : searchResults.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-gray-400">{t('invite.noResults')}</p>
                    ) : (
                      searchResults.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectInviteCandidate(u)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-racing-800"
                        >
                          <UserAvatar name={u.display_name} color={u.avatar_color ?? '#4772FA'} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{u.display_name}</p>
                            <p className="truncate text-xs text-gray-400">@{u.username}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700">
                {inviteRoles.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
              </select>
              <select value={inviteDept} onChange={(e) => setInviteDept(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700">
                <option value="">{t('invite.department')}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button
                type="button"
                onClick={() => void handleInvite()}
                disabled={!selectedInviteUser}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
              >
                <UserPlus size={14} />
                {t('invite.add')}
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <h2 className="mb-3 text-sm font-semibold">{t('members.title')}</h2>
            <ul className="flex flex-col gap-2">
              {members.map((m) => (
                <li key={m.userId} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{m.profile.display_name}</p>
                      <p className="text-xs text-gray-400">@{m.profile.username}</p>
                      {m.profile.role_description && (
                        <p className="mt-1 text-xs text-gray-500">{t('members.roleDescription')}: {m.profile.role_description}</p>
                      )}
                      {(m.profile.app_role === 'admin' || m.profile.is_admin) && (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          {t('roles.appAdmin')}
                        </span>
                      )}
                    </div>
                    {m.role !== 'owner' && canManageOrg(profile, myRole) && (
                      <div className="flex flex-col items-end gap-1">
                        <select value={m.role} onChange={(e) => void updateMemberRole(m.userId, e.target.value as OrgRole)}
                          className="rounded border border-gray-200 bg-transparent px-2 py-1 text-xs dark:border-racing-700">
                          {inviteRoles.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                        </select>
                        <RoleHint type="org" role={m.role} lang={lang} />
                        <select value={m.departmentId ?? ''} onChange={(e) => void handleAssignDept(m.userId, e.target.value)}
                          className="rounded border border-gray-200 bg-transparent px-2 py-1 text-xs dark:border-racing-700">
                          <option value="">{t('members.noDepartment')}</option>
                          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <button type="button" onClick={() => void removeMember(m.userId)} className="text-red-400"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === 'departments' && organization && canManageDepartments(profile, myRole) && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">{t('departments.desc')}</p>
          <form onSubmit={async (e) => {
            e.preventDefault()
            const err = await createDepartment(organization.id, deptName, deptDesc)
            if (err) setError(err)
            else { setDeptName(''); setDeptDesc('') }
          }} className="flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder={t('departments.namePlaceholder')} required
              className="min-w-[160px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" />
            <input value={deptDesc} onChange={(e) => setDeptDesc(e.target.value)} placeholder={t('departments.descPlaceholder')}
              className="min-w-[160px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" />
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">{t('departments.add')}</button>
          </form>
          {departments.length === 0 ? (
            <p className="text-sm text-gray-400">{t('departments.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {departments.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-racing-800 dark:bg-racing-900">
                  <div>
                    <p className="text-sm font-semibold">{d.name}</p>
                    {d.description && <p className="text-xs text-gray-400">{d.description}</p>}
                  </div>
                  <button type="button" onClick={() => void removeDepartment(d.id)} className="text-red-400"><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'teams' && organization && canManageTeams(profile, myRole) && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">{t('teams.desc')}</p>
          <form onSubmit={async (e) => {
            e.preventDefault()
            await createTeam(teamName, organization.id, teamDept || undefined)
            setTeamName('')
            await fetchTeams(organization.id)
          }} className="flex flex-wrap gap-2 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder={t('teams.namePlaceholder')} required
              className="min-w-[160px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700" />
            <select value={teamDept} onChange={(e) => setTeamDept(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-racing-700">
              <option value="">{t('teams.noDepartment')}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">{t('teams.add')}</button>
          </form>
          {teams.length === 0 ? (
            <p className="text-sm text-gray-400">{t('teams.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {teams.map((tm) => (
                <li key={tm.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-racing-800 dark:bg-racing-900">
                  <div>
                    <p className="text-sm font-semibold">{tm.name}</p>
                    <p className="text-xs text-gray-400">
                      {tm.departmentId ? departments.find((d) => d.id === tm.departmentId)?.name : t('teams.noDepartment')}
                      · {tm.members.length} {t('stats.members').toLowerCase()}
                    </p>
                  </div>
                  <button type="button" onClick={() => void removeTeam(tm.id)} className="text-red-400"><Trash2 size={16} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'global' && superAdmin && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">{t('global.desc')}</p>
          <input value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)} placeholder={t('global.searchPlaceholder')}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-racing-700 dark:bg-racing-900" />
          {globalResults.length > 0 && (
            <ul className="flex flex-col gap-2">
              {globalResults.map((u) => (
                <li key={u.id} className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
                  <p className="text-sm font-medium">{u.display_name} <span className="text-gray-400">@{u.username}</span></p>
                  {u.role_description && <p className="text-xs text-gray-500">{u.role_description}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <select defaultValue={u.app_role === 'admin' ? 'admin' : 'user'}
                      onChange={async (e) => {
                        const err = await setAppRole(u.id, e.target.value as AppRole)
                        if (err) setError(err)
                        else { setSaved(u.id); setTimeout(() => setSaved(null), 2000) }
                      }}
                      className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-racing-700">
                      <option value="user">{t('roles.appUser')}</option>
                      <option value="admin">{t('roles.appAdmin')}</option>
                    </select>
                    {organization && (
                      <select defaultValue="member"
                        onChange={async (e) => {
                          const err = await setOrgRole(organization.id, u.id, e.target.value as OrgRole)
                          if (err) setError(err)
                          else { setSaved(u.id); setTimeout(() => setSaved(null), 2000) }
                        }}
                        className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-racing-700">
                        {ORG_ROLES.map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
                      </select>
                    )}
                  </div>
                  <RoleHint type="app" role={u.app_role === 'admin' ? 'admin' : 'user'} lang={lang} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
