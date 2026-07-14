import type { Profile } from '../store/authStore'
import type { AppRole, DepartmentRole, OrgRole } from '../types'

export function getAppRole(profile: Profile | null | undefined): AppRole {
  if (!profile) return 'user'
  if (profile.app_role === 'admin' || profile.is_admin) return 'admin'
  return 'user'
}

export function isSuperAdmin(profile: Profile | null | undefined): boolean {
  return getAppRole(profile) === 'admin'
}

/** Sidebar /admin — App-Admin, Org-Inhaber oder Org-Admin (keine Manager). */
export function canAccessOrgAdminPanel(profile: Profile | null | undefined, orgRole: OrgRole | null): boolean {
  if (isSuperAdmin(profile)) return true
  return orgRole === 'owner' || orgRole === 'admin'
}

/** @deprecated Use canAccessOrgAdminPanel */
export function canAccessAdmin(profile: Profile | null | undefined, orgRole: OrgRole | null): boolean {
  return canAccessOrgAdminPanel(profile, orgRole)
}

/** Org-Inhaber darf Org-Admin und Manager vergeben; Org-Admin nur Member/Manager. */
export function assignableOrgRoles(myOrgRole: OrgRole | null): OrgRole[] {
  if (myOrgRole === 'owner') return ['member', 'manager', 'admin']
  if (myOrgRole === 'admin') return ['member', 'manager']
  return []
}

export function canManageOrg(profile: Profile | null | undefined, orgRole: OrgRole | null): boolean {
  if (isSuperAdmin(profile)) return true
  return orgRole === 'owner' || orgRole === 'admin'
}

export function canManageDepartments(profile: Profile | null | undefined, orgRole: OrgRole | null): boolean {
  if (isSuperAdmin(profile)) return true
  return orgRole === 'owner' || orgRole === 'admin'
}

export function canManageTeams(profile: Profile | null | undefined, orgRole: OrgRole | null): boolean {
  if (isSuperAdmin(profile)) return true
  return orgRole === 'owner' || orgRole === 'admin' || orgRole === 'manager'
}

export function canApproveAbsences(profile: Profile | null | undefined, orgRole: OrgRole | null): boolean {
  if (isSuperAdmin(profile)) return true
  return orgRole === 'owner' || orgRole === 'admin' || orgRole === 'manager'
}

export function canAssignGlobalRoles(profile: Profile | null | undefined): boolean {
  return isSuperAdmin(profile)
}

export const APP_ROLE_LABELS: Record<AppRole, { de: string; en: string; descDe: string; descEn: string }> = {
  user: {
    de: 'Nutzer',
    en: 'User',
    descDe: 'Standard-Zugriff. Berechtigungen über Organisationsrolle.',
    descEn: 'Standard access. Permissions via organization role.',
  },
  admin: {
    de: 'App-Admin',
    en: 'App Admin',
    descDe: 'Höchste Stufe über allen Organisationen — kann globale Rollen vergeben und jede Organisation einsehen.',
    descEn: 'Highest level above all organizations — can assign global roles and access any organization.',
  },
}

export const ORG_ROLE_LABELS: Record<OrgRole, { de: string; en: string; descDe: string; descEn: string }> = {
  owner: {
    de: 'Inhaber',
    en: 'Owner',
    descDe: 'Höchste Rolle in der Organisation — volle Kontrolle, kann Org-Admins ernennen.',
    descEn: 'Highest role in the organization — full control, can appoint org admins.',
  },
  admin: {
    de: 'Org-Admin',
    en: 'Org Admin',
    descDe: 'Verwaltet nur die eigene Organisation (Mitglieder, Bereiche, Teams). Kein Zugriff auf globale Rollen.',
    descEn: 'Manages only their own organization (members, departments, teams). No global role access.',
  },
  manager: {
    de: 'Manager',
    en: 'Manager',
    descDe: 'Genehmigt Urlaub, sieht Team-Reports, verwaltet Teams in seinem Bereich.',
    descEn: 'Approves leave, views team reports, manages teams in their department.',
  },
  member: {
    de: 'Mitglied',
    en: 'Member',
    descDe: 'Standard-Zugriff auf Projekte, Aufgaben und eigene Arbeitszeit.',
    descEn: 'Standard access to projects, tasks and own work time.',
  },
}

export const DEPT_ROLE_LABELS: Record<DepartmentRole, { de: string; en: string }> = {
  head: { de: 'Bereichsleitung', en: 'Department head' },
  member: { de: 'Bereichsmitglied', en: 'Department member' },
}
