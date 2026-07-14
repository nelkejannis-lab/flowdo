import { useState } from 'react'
import { X, Maximize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTaskTrayStore, type MinimizedTask } from '../../store/taskTrayStore'
import { useBoardsStore } from '../../store/boardsStore'
import TaskFormModal from '../tasks/TaskFormModal'
import ProjectTaskFormModal from '../boards/ProjectTaskFormModal'

export default function TaskTray() {
  const { t } = useTranslation('common')
  const { tasks, remove } = useTaskTrayStore()
  const boards = useBoardsStore((s) => s.boards)

  const [activeTask, setActiveTask] = useState<any | null>(null)
  const [activeBoard, setActiveBoard] = useState<any | null>(null)
  const [modalType, setModalType] = useState<'personal' | 'project' | null>(null)

  if (tasks.length === 0) return null

  function handleTaskClick(minTask: MinimizedTask) {
    if (minTask.type === 'personal') {
      setActiveTask(minTask.task)
      setModalType('personal')
    } else {
      const board = boards.find((b) => b.id === minTask.boardId)
      if (board) {
        setActiveTask(minTask.task)
        setActiveBoard(board)
        setModalType('project')
      }
    }
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[45] flex flex-col gap-2 max-w-sm sm:max-w-md">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/95 p-2.5 shadow-lg backdrop-blur-md transition-all duration-200 dark:border-racing-800 dark:bg-racing-900/95"
          >
            <div
              onClick={() => handleTaskClick(task)}
              className="min-w-0 flex-1 cursor-pointer hover:underline"
            >
              <p className="truncate text-xs font-semibold text-gray-800 dark:text-racing-100">
                {task.title}
              </p>
              <span className="mt-0.5 text-[10px] font-bold uppercase text-gray-400">
                {task.type === 'project' ? t('project') : t('inbox')}
              </span>
            </div>

            <button
              onClick={() => handleTaskClick(task)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
              title={t('buttons.maximize')}
            >
              <Maximize2 size={13} />
            </button>

            <button
              onClick={() => remove(task.id)}
              className="text-gray-400 hover:text-red-500"
              title={t('buttons.close')}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {modalType === 'personal' && activeTask && (
        <TaskFormModal
          task={activeTask}
          onClose={() => {
            setModalType(null)
            setActiveTask(null)
          }}
        />
      )}

      {modalType === 'project' && activeTask && activeBoard && (
        <ProjectTaskFormModal
          board={activeBoard}
          task={activeTask}
          onClose={() => {
            setModalType(null)
            setActiveTask(null)
            setActiveBoard(null)
          }}
        />
      )}
    </>
  )
}
