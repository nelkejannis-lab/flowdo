import { useMemo } from 'react'
import {
  filterBoardsByLifeAreaMode,
  filterEntriesByLifeAreaMode,
  filterTasksByLifeAreaMode,
  getEffectiveLifeAreaMode,
  type LifeAreaMode,
} from '../lib/lifeArea'
import { useBoardsStore } from '../store/boardsStore'
import { useSettingsStore } from '../store/settingsStore'
import type { Board, CalendarEntry, Task } from '../types'

export function useLifeAreaMode() {
  const privateAreaEnabled = useSettingsStore((s) => s.privateAreaEnabled)
  const lifeAreaMode = useSettingsStore((s) => s.lifeAreaMode)
  const setLifeAreaMode = useSettingsStore((s) => s.setLifeAreaMode)
  const boards = useBoardsStore((s) => s.boards)

  const mode: LifeAreaMode = getEffectiveLifeAreaMode(privateAreaEnabled, lifeAreaMode)

  return useMemo(
    () => ({
      privateAreaEnabled,
      mode,
      setLifeAreaMode,
      filterTasks: <T extends Pick<Task, 'lifeArea' | 'boardId'>>(tasks: T[]) =>
        filterTasksByLifeAreaMode(tasks, mode, boards),
      filterEntries: <T extends Pick<CalendarEntry, 'lifeArea' | 'boardId'>>(entries: T[]) =>
        filterEntriesByLifeAreaMode(entries, mode, boards),
      filterBoards: <T extends Pick<Board, 'lifeArea'>>(list: T[]) => filterBoardsByLifeAreaMode(list, mode),
    }),
    [privateAreaEnabled, mode, setLifeAreaMode, boards],
  )
}
