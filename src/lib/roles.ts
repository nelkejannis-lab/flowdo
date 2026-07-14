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

export function canAccessAdmin(profile: Profile | null | undefined, orgRole: OrgRole | null): boolean {
  if (isSuperAdmin(profile)) return true
  return orgRole === 'owner' || orgRole === 'admin' || orgRole === 'manager'
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
    descDe: 'Höchste Stufe — kann alles, unabhängig von der Organisation. Kann globale und Organisationsrollen vergeben.',
    descEn: 'Highest level — full access independent of organization. Can assign global and org roles.',
  },
}

export const ORG_ROLE_LABELS: Record<OrgRole, { de: string; en: string; descDe: string; descEn: string }> = {
  owner: {
    de: 'Inhaber',
    en: 'Owner',
    descDe: 'Volle Kontrolle über die Organisation, Bereiche und Mitglieder.',
    descEn: 'Full control over organization, departments and members.',
  },
  admin: {
    de: 'Org-Admin',
    en: 'Org Admin',
    descDe: 'Verwaltet Mitglieder, Bereiche, Teams und Einstellungen.',
    descEn: 'Manages members, departments, teams and settings.',
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
