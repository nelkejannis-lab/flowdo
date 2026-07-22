import type { Board, CalendarEntry, Task } from '../types'

export type LifeArea = 'work' | 'private'

export const LIFE_AREAS: LifeArea[] = ['work', 'private']

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
