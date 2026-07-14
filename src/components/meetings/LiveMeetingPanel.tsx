import { useState } from 'react'
import { Check, Mic, Square, Loader2, Save, Calendar } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMeetingsStore } from '../../store/meetingsStore'
import { useLiveMeetingStore, getLiveMeetingCostEstimate } from '../../store/liveMeetingStore'
import type { MeetingAiQuality } from '../../lib/meetingAiConfig'

export default function LiveMeetingPanel({ onSaveComplete }: { onSaveComplete: () => void }) {
  const { t, i18n } = useTranslation('meetings')
  const [customTitle, setCustomTitle] = useState('')
  const addMeeting = useMeetingsStore(s => s.addMeeting)
  
  const {
    isRecording,
    transcript,
    summary,
    actionItems,
    isSummarizing,
    error,
    analysisCount,
    aiQuality,
    workerReady,
    startRecording,
    stopRecording,
    setAiQuality,
  } = useLiveMeetingStore()

  const costEstimate = getLiveMeetingCostEstimate()

  async function saveMeeting() {
    if (!summary && !transcript) return
    const titleMatch = summary.match(/^# (.*)/) || summary.match(/\*\*(.*?)\*\*/)
    const title = customTitle.trim() || (titleMatch ? titleMatch[1] : t('live.defaultTitle', { date: new Date().toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'de-DE') }))

    await addMeeting({
      title,
      date: new Date().toISOString(),
      transcript,
      summary,
      action_items: actionItems
    })
    
    useLiveMeetingStore.getState().reset()
    onSaveComplete()
  }

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-racing-900 border border-gray-100 dark:border-racing-800 gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Mic className={isRecording ? "text-red-500 animate-pulse" : "text-gray-400"} />
            {t('liveMeetingTitle')}
          </h2>
          <p className="text-xs text-gray-500 mb-3">{t('live.subtitle')}</p>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <span>{t('live.aiQuality')}</span>
              <select
                value={aiQuality}
                onChange={(e) => setAiQuality(e.target.value as MeetingAiQuality)}
                disabled={isRecording}
                className="rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xs focus:border-accent focus:outline-none dark:border-racing-700 disabled:opacity-50"
              >
                <option value="economy">{t('live.qualityEconomy')}</option>
                <option value="balanced">{t('live.qualityBalanced')}</option>
                <option value="quality">{t('live.qualityHigh')}</option>
              </select>
            </label>
            {isRecording && (
              <span className="text-xs text-gray-400">
                {workerReady ? t('live.transcriptionReady') : t('live.loadingWhisper')}
              </span>
            )}
            {analysisCount > 0 && (
              <span className="text-xs text-gray-400">
                {t('live.analysisCount', { count: analysisCount })}
                {costEstimate ? ` · ${t('live.estimatedCost', { cost: costEstimate })}` : ''}
              </span>
            )}
          </div>

          <input
            type="text"
            placeholder={t('live.namePlaceholder')}
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
            disabled={isRecording}
            className="w-full sm:w-64 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-racing-700 bg-transparent focus:border-accent focus:outline-none disabled:opacity-50"
          />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {!isRecording ? (
            <button 
              onClick={startRecording}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-accent-hover transition-all"
            >
              <Mic size={16} /> {t('live.startRecording')}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-red-600 animate-pulse"
            >
              <Square size={16} fill="currentColor" /> {t('live.stopRecording')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* AI Analysis Column (Full Width) */}
        
          {/* Summary Top Half */}
          <div className="flex flex-col rounded-xl bg-white p-4 shadow-sm dark:bg-racing-900 border border-gray-100 dark:border-racing-800 min-h-[300px]">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-racing-800 shrink-0">
              <div className="flex items-center gap-2">
                <Check size={18} className="text-accent" />
                <h3 className="font-semibold">{t('live.liveSummary')}</h3>
              </div>
              <div className="flex items-center gap-2">
                {isSummarizing && (
                  <span className="text-xs text-gray-400">{t('live.updatingSummary')}</span>
                )}
                {isSummarizing && <Loader2 size={16} className="animate-spin text-accent" />}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 text-sm">
              {!summary && !isSummarizing && (
                <span className="text-gray-400 italic">{t('live.waitingForSpeech')}</span>
              )}
              
              {summary && (
                <div className="prose prose-sm dark:prose-invert">
                  <div className="whitespace-pre-wrap text-sm">{summary}</div>
                </div>
              )}
            </div>
          </div>

          {/* To-Dos Bottom Half */}
          <div className="flex flex-col rounded-xl bg-white p-4 shadow-sm dark:bg-racing-900 border border-gray-100 dark:border-racing-800 min-h-[300px]">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-racing-800 shrink-0">
              <div className="flex items-center gap-2">
                <Check size={18} className="text-orange-500" />
                <h3 className="font-semibold">{t('live.detectedTodos')}</h3>
              </div>
              <span className="text-xs bg-orange-100 text-orange-600 dark:bg-orange-500/20 px-2 py-1 rounded-md font-bold">{actionItems.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 text-sm">
              {actionItems.length === 0 ? (
                <span className="text-gray-400 italic">{t('live.noTodosYet')}</span>
              ) : (
                <ul className="space-y-2">
                  {actionItems.map((item, i) => (
                    <li key={i} className="flex flex-col gap-1 rounded-lg bg-gray-50 p-2 dark:bg-racing-800">
                      <div className="flex items-start gap-2">
                        <input type="checkbox" className="mt-1" />
                        <div className="flex-1">
                          <span className="font-medium">{item.task}</span>
                          {item.assignee && <span className="ml-2 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent font-bold">@{item.assignee}</span>}
                        </div>
                      </div>
                      {item.dueDate && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 ml-6">
                          <Calendar size={10} />
                          <span>{t('live.due', { date: item.dueDate })}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!isRecording && (summary || transcript) && (
              <button 
                onClick={saveMeeting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-green-600 transition-all shrink-0"
              >
                <Save size={18} /> {t('live.saveMeeting')}
              </button>
            )}
          </div>
      </div>
    </div>
  )
}
