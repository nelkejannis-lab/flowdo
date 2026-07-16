import type { NavItemKey } from '../../store/settingsStore'

/** Core destinations used by mobile bottom nav / defaults. */
export const PRIMARY_NAV_KEYS: NavItemKey[] = ['dashboard', 'tasks', 'calendar', 'projekte']

export const NAV_PATHS: Record<NavItemKey, { to: string; exact?: boolean }> = {
  dashboard: { to: '/', exact: true },
  week: { to: '/tasks/week' },
  inbox: { to: '/tasks/inbox' },
  tasks: { to: '/tasks', exact: true },
  calendar: { to: '/calendar' },
  termine: { to: '/termine' },
  brain: { to: '/creative-board' },
  memory: { to: '/memory' },
  eisenhower: { to: '/eisenhower' },
  worktime: { to: '/arbeitszeit' },
  aiScheduler: { to: '/ki-termine' },
  chat: { to: '/chat' },
  friends: { to: '/friends' },
  social: { to: '/social' },
  meetings: { to: '/meetings' },
  projekte: { to: '/projekte', exact: true },
}

/** Max pin shortcuts in the top bar pin strip (visible when menu is collapsed). */
export const MAX_TOPBAR_PINS = 8
