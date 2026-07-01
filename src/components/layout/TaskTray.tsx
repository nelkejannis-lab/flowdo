import { useState } from 'react'
import { Play, Pause, X, Maximize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTaskTrayStore, type MinimizedTask } from '../../store/taskTrayStore'
import { usePomodoroStore } from '../../store/pomodoroStore'
import { useBoardsStore } from '../../store/boardsStore'
import TaskFormModal from '../tasks/TaskFormModal'
import ProjectTaskFormModal from '../boards/ProjectTaskFormModal'

export default function TaskTray() {
  const { t } = useTranslation('common')
  const { tasks, remove } = useTaskTrayStore()
  const pomodoro = usePomodoroStore()
  const boards = useBoardsStore((s) => s.boards)

  const [activeTask, setActiveTask] = useState<any | null>(null)
  const [activeBoard, setActiveBoard] = useState<any | null>(null)
  const [modalType, setModalType] = useState<'personal' | 'project' | null>(null)

  if (tasks.length === 0) return null

  const isTimerRunning = pomodoro.running
  const activeTaskId = pomodoro.activeTaskId

  const mins = Math.floor(pomodoro.timeLeft / 60).toString().padStart(2, '0')
  const secs = (pomodoro.timeLeft % 60).toString().padStart(2, '0')

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
        {tasks.map((task) => {
          const isActive = activeTaskId === task.id
          return (
            <div
              key={task.id}
              className={`flex items-center gap-2 rounded-xl border p-2.5 shadow-lg backdrop-blur-md transition-all duration-200 ${
                isActive && isTimerRunning
                  ? 'border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20'
                  : 'border-gray-200 bg-white/95 dark:border-racing-800 dark:bg-racing-900/95'
              }`}
            >
              <button
                onClick={() => {
                  if (isActive && isTimerRunning) {
                    pomodoro.setRunning(false)
                  } else {
                    pomodoro.setActiveTask(task.id, task.type)
                    pomodoro.setRunning(true)
                  }
                }}
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                  isActive && isTimerRunning
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-accent hover:text-white dark:bg-racing-800 dark:text-racing-200'
                }`}
              >
                {isActive && isTimerRunning ? (
                  <Pause size={12} className="animate-pulse" />
                ) : (
                  <Play size={12} className="ml-0.5" />
                )}
              </button>

              <div
                onClick={() => handleTaskClick(task)}
                className="flex-1 min-w-0 cursor-pointer hover:underline"
              >
                <p className="truncate text-xs font-semibold text-gray-800 dark:text-racing-100">
                  {task.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400">
                    {task.type === 'project' ? t('project') : t('inbox')}
                  </span>
                  {isActive && (
                    <span className="text-[10px] font-mono font-bold text-emerald-500 dark:text-emerald-400">
                      ⏱ {mins}:{secs}
                    </span>
                  )}
                </div>
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
          )
        })}
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
