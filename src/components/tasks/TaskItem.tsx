import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, HelpCircle, ListChecks, MessageSquare, Moon, Repeat, Send, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Task } from '../../types'
import { useTasksStore } from '../../store/tasksStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { useCommentsStore } from '../../store/commentsStore'
import { useFriendsStore } from '../../store/friendsStore'
import { useNotificationsStore } from '../../store/notificationsStore'
import { formatFriendlyDate, isOverdue } from '../../utils/date'
import BoardBadge from '../boards/BoardBadge'
import PriorityBadge from './PriorityBadge'
import CommentSection from '../shared/CommentSection'
import { isSupabaseConfigured } from '../../lib/supabase'

interface TaskItemProps {
  task: Task
  onClick?: () => void
  showBoard?: boolean
  priorityRank?: number
}

const friendlyDateKeys: Record<string, string> = {
  'Heute': 'item.dateToday',
  'Morgen': 'item.dateTomorrow',
  'Gestern': 'item.dateYesterday',
}

export default function TaskItem({ task, onClick, showBoard = true, priorityRank }: TaskItemProps) {
  const { t } = useTranslation('tasks')
  const toggleTaskCompleted = useTasksStore((s) => s.toggleTaskCompleted)
  const snoozeTask = useTasksStore((s) => s.snoozeTask)
  const toggleProjectTaskCompleted = useProjectTasksStore((s) => s.toggleTaskCompleted)
  const toggleSubtask = useTasksStore((s) => s.toggleSubtask)
  const toggleProjectSubtask = useProjectTasksStore((s) => s.toggleSubtask)
  const friends = useFriendsStore((s) => s.friends)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)
  const askQuestion = useNotificationsStore((s) => s.askQuestion)

  useEffect(() => {
    if (isSupabaseConfigured && friends.length === 0) fetchFriends()
  }, [])
  const [expanded, setExpanded] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showAsk, setShowAsk] = useState(false)
  const [askTo, setAskTo] = useState('')
  const [askText, setAskText] = useState('')
  const [askSending, setAskSending] = useState(false)
  const [askDone, setAskDone] = useState(false)
  const askRef = useRef<HTMLDivElement>(null)
  const commentCount = useCommentsStore((s) => (s.comments[task.id] ?? []).length)
  const overdue = isOverdue(task.dueDate) && !task.completed
  const hasSubtasks = task.subtasks.length > 0
  const subtaskDone = task.subtasks.filter((s) => s.completed).length

  return (
    <div className="card-apple group relative transition-all duration-300 hover:shadow-apple-md hover:-translate-y-[1px] active:scale-[0.98]">
      <div className="flex items-start gap-3 px-3 py-3">
        {/* Priority rank number */}
        {priorityRank != null && !task.completed && (
          <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold tabular-nums text-accent">
            {priorityRank}
          </span>
        )}

        {/* Complete toggle */}
        <button
          onClick={() => {
            if (task.boardId) toggleProjectTaskCompleted(task.id)
            else toggleTaskCompleted(task.id)
          }}
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
            task.completed ? 'border-accent bg-accent text-white' : 'border-gray-400 hover:border-accent dark:border-racing-500'
          }`}
        >
          {task.completed && <Check size={12} />}
        </button>

        {!task.completed && !task.boardId && (
          <button
            onClick={(e) => { e.stopPropagation(); snoozeTask(task.id, 24) }}
            className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-amber-100 hover:text-amber-600 dark:bg-racing-800"
            title={t('item.snooze')}
          >
            <Clock size={10} />
          </button>
        )}

        {/* Title & Metadata — clickable to open modal */}
        <div className="min-w-0 flex-1 cursor-pointer py-0.5" onClick={onClick}>
          <p className={`break-words text-base sm:text-sm font-medium leading-snug ${task.completed ? 'text-gray-400 line-through' : ''}`}>
            {task.title}
          </p>
          
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-400">
            {task.dueDate && (
              <span className={overdue ? 'font-medium text-red-500' : ''}>
                {(() => {
                  const friendly = formatFriendlyDate(task.dueDate)
                  return friendlyDateKeys[friendly] ? t(friendlyDateKeys[friendly]) : friendly
                })()}
              </span>
            )}
            {task.evening && (
              <span className="flex items-center gap-1" title={t('item.tonight')}>
                <Moon size={12} />
              </span>
            )}
            {task.recurrence && (
              <span className="flex items-center gap-1" title={t('item.recurring')}>
                <Repeat size={12} />
              </span>
            )}
            {hasSubtasks && (
              <span className="flex items-center gap-1">
                <ListChecks size={12} />
                {subtaskDone}/{task.subtasks.length}
              </span>
            )}
            <PriorityBadge priority={task.priority} />
            {showBoard && task.boardId && <BoardBadge boardId={task.boardId} />}
            {task.tags.map((tag) => (
              <span key={tag} className="hidden sm:inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-racing-800 dark:text-racing-200">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Kommentare */}
        {isSupabaseConfigured && (
          <button
            onClick={() => setShowComments((v) => !v)}
            className={`mt-0.5 flex flex-shrink-0 items-center gap-1 rounded p-1 text-xs hover:bg-gray-100 dark:hover:bg-racing-800 ${showComments ? 'text-accent' : 'text-gray-500 hover:text-gray-700 dark:text-racing-300 dark:hover:text-white'}`}
            title={t('item.comments')}
          >
            <MessageSquare size={14} />
            {commentCount > 0 && <span className="text-[10px]">{commentCount}</span>}
          </button>
        )}

        {/* Frage stellen */}
        {isSupabaseConfigured && (
          <div className="relative mt-0.5" ref={askRef}>
            <button
              onClick={() => { setShowAsk((v) => !v); setAskDone(false) }}
              className={`flex flex-shrink-0 items-center gap-1 rounded p-1 text-xs hover:bg-violet-50 dark:hover:bg-racing-800 ${showAsk ? 'text-violet-500' : 'text-gray-500 hover:text-violet-500 dark:text-racing-300'}`}
              title={t('item.askColleague')}
            >
              <HelpCircle size={14} />
            </button>
            {showAsk && (
              <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-racing-700 dark:bg-racing-900">
                {askDone ? (
                  <p className="py-2 text-center text-xs text-emerald-500">✓ {t('item.questionSent')}</p>
                ) : friends.length === 0 ? (
                  <p className="py-2 text-center text-xs text-gray-400">{t('item.addColleaguesFirst')}</p>
                ) : (
                  <>
                    <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-racing-200">{t('item.askQuestionTitle')}</p>
                    <select
                      value={askTo}
                      onChange={(e) => setAskTo(e.target.value)}
                      className="mb-2 w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-xs focus:border-accent focus:outline-none dark:border-racing-700"
                    >
                      <option value="">{t('item.chooseColleague')}</option>
                      {friends.map((f) => (
                        <option key={f.profile.id} value={f.profile.id}>{f.profile.display_name}</option>
                      ))}
                    </select>
                    <textarea
                      value={askText}
                      onChange={(e) => setAskText(e.target.value)}
                      placeholder={t('item.yourQuestion')}
                      rows={2}
                      className="mb-2 w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-xs focus:border-accent focus:outline-none dark:border-racing-700"
                    />
                    <button
                      disabled={!askTo || !askText.trim() || askSending}
                      onClick={async () => {
                        setAskSending(true)
                        await askQuestion(askTo, task.id, task.title, askText.trim())
                        setAskSending(false)
                        setAskDone(true)
                        setAskText('')
                        setAskTo('')
                        setTimeout(() => setShowAsk(false), 1500)
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
                    >
                      <Send size={11} />
                      {askSending ? t('item.sending') : t('item.sendQuestion')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Expand-Button für Unteraufgaben */}
        {hasSubtasks && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 flex flex-shrink-0 items-center gap-1 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-racing-300 dark:hover:bg-racing-800 dark:hover:text-white"
            title={expanded ? t('item.collapse') : t('item.showSubtasks')}
          >
            <ChevronDown size={16} className={`transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`} />
          </button>
        )}
      </div>

      {showComments && (
        <div className="border-t border-gray-100 px-3 py-3 dark:border-racing-800">
          <CommentSection taskId={task.id} />
        </div>
      )}

      {expanded && hasSubtasks && (
        <div className="border-t border-gray-100 px-3 py-2 pl-11 dark:border-racing-800">
          {/* Progress bar */}
          <div className="mb-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-racing-800">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${task.subtasks.length ? (subtaskDone / task.subtasks.length) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400">{subtaskDone}/{task.subtasks.length}</span>
          </div>
          <div className="flex flex-col gap-1">
            {task.subtasks.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (task.boardId) toggleProjectSubtask(task.id, s.id)
                    else toggleSubtask(task.id, s.id)
                  }}
                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    s.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
                  }`}
                >
                  {s.completed && <Check size={10} />}
                </button>
                <span className={`flex-1 text-sm ${s.completed ? 'text-gray-400 line-through' : ''}`}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
