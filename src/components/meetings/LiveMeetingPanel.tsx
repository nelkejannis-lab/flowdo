import { useEffect, useRef, useState } from 'react'
import { AudioRecorder } from '../../lib/audioRecorder'
import { generateMeetingSummary, loadWhisperModel } from '../../lib/aiService'
import { Check, Mic, Square, Loader2, Save, RefreshCw } from 'lucide-react'
import { useMeetingsStore, type ActionItem } from '../../store/meetingsStore'
import { useSettingsStore } from '../../store/settingsStore'

export default function LiveMeetingPanel({ onSaveComplete }: { onSaveComplete: () => void }) {
  const [isRecording, setIsRecording] = useState(false)
  const [isLoadingModel, setIsLoadingModel] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [summary, setSummary] = useState('')
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customTitle, setCustomTitle] = useState('')
  
  const recorderRef = useRef<AudioRecorder | null>(null)
  const transcriptRef = useRef(transcript)
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

    try {
      setIsLoadingModel(true)
      await loadWhisperModel()
      setIsLoadingModel(false)

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

      // Trigger analysis every 60 seconds
      analysisIntervalRef.current = setInterval(() => {
        triggerAnalysis()
      }, 60000)
    } catch (err: any) {
      setError(err.message)
      setIsLoadingModel(false)
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
        done: false
      })))
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
            {isLoadingModel && (
              <span className="text-xs text-accent flex items-center gap-1 bg-accent/10 px-2 py-1 rounded-full ml-2">
                <RefreshCw size={12} className="animate-spin" />
                KI-Sprachmodell wird geladen...
              </span>
            )}
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
              disabled={isLoadingModel}
              onClick={handleStart}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-accent-hover transition-all disabled:opacity-50"
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

        {/* AI Analysis Column */}
        <div className="flex flex-col rounded-xl bg-white p-4 shadow-sm dark:bg-racing-900 border border-gray-100 dark:border-racing-800">
          <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-racing-800">
            <div className="flex items-center gap-2">
              <Check size={18} className="text-accent" />
              <h3 className="font-semibold">KI Zusammenfassung & Tasks</h3>
            </div>
            {isSummarizing && <Loader2 size={16} className="animate-spin text-accent" />}
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 text-sm">
            {!summary && !isSummarizing && (
              <span className="text-gray-400 italic">Die erste Analyse startet automatisch nach ca. 60 Sekunden...</span>
            )}
            
            {summary && (
              <div className="prose prose-sm dark:prose-invert mb-6">
                <div dangerouslySetInnerHTML={{ __html: summary.replace(/\n/g, '<br/>') }} />
              </div>
            )}

            {actionItems.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-2 font-bold text-accent">Erkannte To-Dos</h4>
                <ul className="space-y-2">
                  {actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg bg-gray-50 p-2 dark:bg-racing-800">
                      <input type="checkbox" className="mt-1" />
                      <div className="flex-1">
                        <span className="font-medium">{item.task}</span>
                        {item.assignee && <span className="ml-2 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent font-bold">@{item.assignee}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {!isRecording && (summary || transcript) && (
            <button 
              onClick={saveMeeting}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-green-600 transition-all"
            >
              <Save size={18} /> Meeting Speichern
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
