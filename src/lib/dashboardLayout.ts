/**
 * Dashboard layout: known section IDs, defaults, and order normalization.
 * Quick Add stays outside this list (always sticky / always on).
 */

export type DashboardSectionId =
  | 'todayHero'
  | 'weekFocus'
  | 'weather'
  | 'dayPlan'
  | 'topPriority'
  | 'dayCapacity'
  | 'weekOverview'
  | 'dueThisWeek'
  | 'workoffice'
  | 'stats'
  | 'upcomingDeadlines'
  | 'nextEvents'
  | 'projectsOverview'

/** Visual default matching the current NOVAT dashboard. */
export const DEFAULT_DASHBOARD_SECTION_ORDER: DashboardSectionId[] = [
  'todayHero',
  'weekFocus',
  'weather',
  'dayPlan',
  'topPriority',
  'dayCapacity',
  'weekOverview',
  'dueThisWeek',
  'workoffice',
  'stats',
  'upcomingDeadlines',
  'nextEvents',
  'projectsOverview',
]

export const DASHBOARD_SECTION_SET = new Set<string>(DEFAULT_DASHBOARD_SECTION_ORDER)

/** Sections that render as a side-by-side pair when adjacent & both visible. */
export const CAPACITY_PAIR = new Set<DashboardSectionId>(['dayCapacity', 'weekOverview'])

/** Focus-tool cluster: consecutive items share the left/right grid when possible. */
export const FOCUS_TOOL_SET = new Set<DashboardSectionId>(['weather', 'dayPlan', 'topPriority'])

export function normalizeDashboardSectionOrder(order: unknown): DashboardSectionId[] {
  const seen = new Set<string>()
  const result: DashboardSectionId[] = []
  if (Array.isArray(order)) {
    for (const raw of order) {
      const id = String(raw)
      if (DASHBOARD_SECTION_SET.has(id) && !seen.has(id)) {
        seen.add(id)
        result.push(id as DashboardSectionId)
      }
    }
  }
  for (const id of DEFAULT_DASHBOARD_SECTION_ORDER) {
    if (!seen.has(id)) result.push(id)
  }
  return result
}

export type DashboardLayoutBlock =
  | { type: 'single'; id: DashboardSectionId }
  | { type: 'capacityPair'; ids: DashboardSectionId[] }
  | { type: 'focusCluster'; ids: DashboardSectionId[] }

/**
 * Collapse consecutive capacity / focus-tool sections into layout blocks
 * so the default view keeps Tageskapazität|Wochenüberblick side-by-side
 * and the weather/dayPlan/topPriority grid.
 */
export function buildDashboardLayoutBlocks(
  order: DashboardSectionId[],
  visible: (id: DashboardSectionId) => boolean,
): DashboardLayoutBlock[] {
  const visibleOrder = order.filter(visible)
  const blocks: DashboardLayoutBlock[] = []
  let i = 0
  while (i < visibleOrder.length) {
    const id = visibleOrder[i]

    if (CAPACITY_PAIR.has(id)) {
      const ids: DashboardSectionId[] = []
      while (i < visibleOrder.length && CAPACITY_PAIR.has(visibleOrder[i])) {
        ids.push(visibleOrder[i])
        i++
      }
      if (ids.length >= 2) blocks.push({ type: 'capacityPair', ids })
      else blocks.push({ type: 'single', id: ids[0] })
      continue
    }

    if (FOCUS_TOOL_SET.has(id)) {
      const ids: DashboardSectionId[] = []
      while (i < visibleOrder.length && FOCUS_TOOL_SET.has(visibleOrder[i])) {
        ids.push(visibleOrder[i])
        i++
      }
      if (ids.length >= 2) blocks.push({ type: 'focusCluster', ids })
      else blocks.push({ type: 'single', id: ids[0] })
      continue
    }

    blocks.push({ type: 'single', id })
    i++
  }
  return blocks
}
