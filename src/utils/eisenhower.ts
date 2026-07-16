import type { Task } from '../types'

/** True only when the user explicitly placed the task on the matrix. */
export function isMatrixPlaced(task: Pick<Task, 'matrixPlaced' | 'urgent' | 'important'>): boolean {
  if (typeof task.matrixPlaced === 'boolean') return task.matrixPlaced
  // Legacy rows: Q1–Q3 counted as placed; never treat bare (false,false) as Q4.
  return Boolean(task.urgent || task.important)
}

export function matrixPlacement(
  urgent: boolean,
  important: boolean
): Pick<Task, 'urgent' | 'important' | 'matrixPlaced'> {
  return { urgent, important, matrixPlaced: true }
}

export function clearMatrixPlacement(): Pick<Task, 'urgent' | 'important' | 'matrixPlaced'> {
  return { urgent: false, important: false, matrixPlaced: false }
}
