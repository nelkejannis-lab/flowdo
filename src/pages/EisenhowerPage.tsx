import { useEffect, useMemo } from 'react'
import { useTasksStore } from '../store/tasksStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { useBoardsStore } from '../store/boardsStore'
import { isSupabaseConfigured } from '../lib/supabase'
import EisenhowerMatrixBoard from '../components/tasks/EisenhowerMatrixBoard'
import { useLifeAreaMode } from '../hooks/useLifeAreaMode'

export default function EisenhowerPage() {
  const personalTasks = useTasksStore((s) => s.tasks)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const fetchMyTasks = useProjectTasksStore((s) => s.fetchMyTasks)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const { filterTasks } = useLifeAreaMode()

  const tasks = useMemo(
    () => filterTasks([...personalTasks, ...myProjectTasks]),
    [personalTasks, myProjectTasks, filterTasks],
  )

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchMyTasks()
      fetchBoards()
    }
  }, [fetchMyTasks, fetchBoards])

  return <EisenhowerMatrixBoard tasks={tasks} showTitle includeNeitherQuadrant />
}
