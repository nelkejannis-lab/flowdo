import type { Board, CalendarEntry, Task } from '../types'

export type LifeArea = 'work' | 'private'
export type LifeAreaMode = 'work' | 'private' | 'all'

export const LIFE_AREAS: LifeArea[] = ['work', 'private']
export const LIFE_AREA_MODES: LifeAreaMode[] = ['work', 'private', 'all']

export function resolveTaskLifeArea(task: Pick<Task, 'lifeArea' | 'boardId'>, boards: Pick<Board, 'id' | 'lifeArea'>[] = []): LifeArea {
  if (task.lifeArea) return task.lifeArea
  if (task.boardId) {
    const board = boards.find((b) => b.id === task.boardId)
    if (board?.lifeArea) return board.lifeArea
  }
  return 'work'
}

export function resolveEntryLifeArea(entry: Pick<CalendarEntry, 'lifeArea' | 'boardId'>, boards: Pick<Board, 'id' | 'lifeArea'>[] = []): LifeArea {
  if (entry.lifeArea) return entry.lifeArea
  if (entry.boardId) {
    const board = boards.find((b) => b.id === entry.boardId)
    if (board?.lifeArea) return board.lifeArea
  }
  return 'work'
}

export function getEffectiveLifeAreaMode(privateAreaEnabled: boolean, lifeAreaMode: LifeAreaMode): LifeAreaMode {
  return privateAreaEnabled ? lifeAreaMode : 'work'
}

export function matchesLifeAreaMode(area: LifeArea, mode: LifeAreaMode): boolean {
  if (mode === 'all') return true
  return area === mode
}

export function filterTasksByLifeAreaMode<T extends Pick<Task, 'lifeArea' | 'boardId'>>(
  tasks: T[],
  mode: LifeAreaMode,
  boards: Pick<Board, 'id' | 'lifeArea'>[] = [],
): T[] {
  if (mode === 'all') return tasks
  return tasks.filter((task) => matchesLifeAreaMode(resolveTaskLifeArea(task, boards), mode))
}

export function filterEntriesByLifeAreaMode<T extends Pick<CalendarEntry, 'lifeArea' | 'boardId'>>(
  entries: T[],
  mode: LifeAreaMode,
  boards: Pick<Board, 'id' | 'lifeArea'>[] = [],
): T[] {
  if (mode === 'all') return entries
  return entries.filter((entry) => matchesLifeAreaMode(resolveEntryLifeArea(entry, boards), mode))
}

export function filterBoardsByLifeAreaMode<T extends Pick<Board, 'lifeArea'>>(boards: T[], mode: LifeAreaMode): T[] {
  if (mode === 'all') return boards
  return boards.filter((board) => matchesLifeAreaMode(board.lifeArea ?? 'work', mode))
}
