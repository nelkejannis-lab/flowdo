import { useEffect, useRef, useState } from 'react'
import { AudioRecorder } from '../../lib/audioRecorder'
import { generateMeetingSummary } from '../../lib/aiService'
import { Check, Mic, Square, Loader2, Save, RefreshCw, Calendar } from 'lucide-react'
import { useMeetingsStore, type ActionItem } from '../../store/meetingsStore'

export default function LiveMeetingPanel({ onSaveComplete }: { onSaveComplete: () => void }) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [summary, setSummary] = useState('')
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customTitle, setCustomTitle] = useState('')
  
  const recorderRef = useRef<AudioRecorder | null>(null)
  const transcriptRef = useRef(transcript)
  const lastAnalyzedTextRef = useRef('')
  const analysisIntervalRef = useRef<any>(null)

  const addMeeting = useMeetingsStore(s => s.addMeeting)

  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  useEffect(() => {
    return () => {
      if (recorderRef.current) recorderRef.current.stop()
      if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current)
    }
  }, [])

  async function handleStart() {
    setError(null)
    setTranscript('')
    setSummary('')
    setActionItems([])
    lastAnalyzedTextRef.current = ''

    try {
      const recorder = new AudioRecorder()
      recorder.onTranscriptChunk = (chunk) => {
        setTranscript(prev => prev + (prev ? ' ' : '') + chunk)
      }
      recorder.onError = (err) => {
        setError(err)
        handleStop()
      }

      await recorder.start()
      recorderRef.current = recorder
      setIsRecording(true)

      // Trigger intelligent analysis every 30 seconds if enough new text exists
      analysisIntervalRef.current = setInterval(() => {
        const currentText = transcriptRef.current
        const diffLength = currentText.length - lastAnalyzedTextRef.current.length
        if (diffLength > 100) { // Only analyze if there are new characters
          triggerAnalysis()
        }
      }, 30000)
    } catch (err: any) {
      setError(err.message)
    }
  }

  function handleStop() {
    if (recorderRef.current) {
      recorderRef.current.stop()
    }
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current)
    }
    setIsRecording(false)
    triggerAnalysis() // Final analysis
  }

  async function triggerAnalysis() {
    const currentText = transcriptRef.current
    if (currentText.length < 50) return // Not enough data yet

    setIsSummarizing(true)
    try {
      const result = await generateMeetingSummary(currentText)
      setSummary(result.summary)
      setActionItems(result.actionItems.map(ai => ({
        id: crypto.randomUUID(),
        task: ai.task,
        assignee: ai.assignee,
        dueDate: ai.dueDate,
        done: false
      })))
      lastAnalyzedTextRef.current = currentText
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSummarizing(false)
    }
  }

  async function saveMeeting() {
    if (!summary && !transcript) return
    const titleMatch = summary.match(/^# (.*)/) || summary.match(/\*\*(.*?)\*\*/)
    const title = customTitle.trim() || (titleMatch ? titleMatch[1] : 'Meeting am ' + new Date().toLocaleDateString())

    await addMeeting({
      title,
      date: new Date().toISOString(),
      transcript,
      summary,
      action_items: actionItems
    })
    
    onSaveComplete()
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm dark:bg-racing-900 border border-gray-100 dark:border-racing-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Mic className={isRecording ? "text-red-500 animate-pulse" : "text-gray-400"} />
            Live Meeting
          </h2>
          <p className="text-xs text-gray-500 mb-3">Nimmt PC-Sound und Mikrofon auf und transkribiert in Echtzeit.</p>
          
          <input 
            type="text" 
            placeholder="Meeting Name (optional)" 
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
            disabled={isRecording}
            className="w-64 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-racing-700 bg-transparent focus:border-accent focus:outline-none disabled:opacity-50"
          />
        </div>
        <div className="flex items-center gap-3">
          {error && <p className="text-xs text-red-500">{error}</p>}
          {!isRecording ? (
            <button 
              onClick={handleStart}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-accent-hover transition-all"
            >
              <Mic size={16} /> Start Recording
            </button>
          ) : (
            <button 
              onClick={handleStop}
              className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-red-600 animate-pulse"
            >
              <Square size={16} fill="currentColor" /> Stop Recording
            </button>
          )}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-4 min-h-0">
        {/* Transcript Column */}
        <div className="flex flex-col rounded-xl bg-white p-4 shadow-sm dark:bg-racing-900 border border-gray-100 dark:border-racing-800">
          <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-3 dark:border-racing-800">
            <Mic size={18} className="text-accent" />
            <h3 className="font-semibold">Live Transkript</h3>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {transcript || <span className="text-gray-400 italic">Noch kein Text erkannt... (sprich oder spiele PC-Sound ab)</span>}
          </div>
        </div>

        {/* AI Analysis Column (Split Vertically) */}
        <div className="flex flex-col gap-4 min-h-0">
          
          {/* Summary Top Half */}
          <div className="flex flex-col flex-1 rounded-xl bg-white p-4 shadow-sm dark:bg-racing-900 border border-gray-100 dark:border-racing-800 min-h-0">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-racing-800 shrink-0">
              <div className="flex items-center gap-2">
                <Check size={18} className="text-accent" />
                <h3 className="font-semibold">Live Zusammenfassung</h3>
              </div>
              {isSummarizing && <Loader2 size={16} className="animate-spin text-accent" />}
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 text-sm">
              {!summary && !isSummarizing && (
                <span className="text-gray-400 italic">Die erste Analyse startet automatisch, sobald genug gesprochen wurde...</span>
              )}
              
              {summary && (
                <div className="prose prose-sm dark:prose-invert">
                  <div dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br/>') }} />
                </div>
              )}
            </div>
          </div>

          {/* To-Dos Bottom Half */}
          <div className="flex flex-col flex-1 rounded-xl bg-white p-4 shadow-sm dark:bg-racing-900 border border-gray-100 dark:border-racing-800 min-h-0">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-racing-800 shrink-0">
              <div className="flex items-center gap-2">
                <Check size={18} className="text-orange-500" />
                <h3 className="font-semibold">Erkannte To-Dos</h3>
              </div>
              <span className="text-xs bg-orange-100 text-orange-600 dark:bg-orange-500/20 px-2 py-1 rounded-md font-bold">{actionItems.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 text-sm">
              {actionItems.length === 0 ? (
                <span className="text-gray-400 italic">Noch keine To-Dos erkannt.</span>
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
                          <span>Fällig: {item.dueDate}</span>
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
                <Save size={18} /> Meeting Speichern
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
