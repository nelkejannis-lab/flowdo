import type { Task } from '../../types'
import EisenhowerMatrixBoard from './EisenhowerMatrixBoard'

interface TaskEisenhowerGridProps {
  tasks: Task[]
  defaultDueDate?: string
}

/** Matrix view scoped to a caller-filtered task set (e.g. Today / All). */
export default function TaskEisenhowerGrid({ tasks, defaultDueDate }: TaskEisenhowerGridProps) {
  return <EisenhowerMatrixBoard tasks={tasks} defaultDueDate={defaultDueDate} includeNeitherQuadrant />
}
