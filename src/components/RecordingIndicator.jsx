import { useNavigate } from 'react-router-dom'
import { Record } from '@phosphor-icons/react'
import { useRecording } from '../lib/recording'

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Persistent, global sidebar pill that shows which meeting is currently
 * being recorded. Clicking it jumps back to that meeting's page. Hidden
 * when nothing is being recorded.
 */
export default function RecordingIndicator() {
  const navigate = useNavigate()
  const { activeMeetingId, activeTitle, status, seconds } = useRecording()

  if (!activeMeetingId) return null

  const isWorking = status.type === 'working'

  return (
    <button
      onClick={() => navigate(`/meetings/${activeMeetingId}`)}
      className="mx-2 mb-2 p-2.5 rounded-md border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-600/10 hover:bg-emerald-100 dark:hover:bg-emerald-600/15 transition-colors text-left group"
      title="Jump to recording"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={`${
              isWorking ? 'bg-amber-500' : 'bg-emerald-500'
            } absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping`}
          />
          <span
            className={`${
              isWorking ? 'bg-amber-500' : 'bg-emerald-500'
            } relative inline-flex h-2 w-2 rounded-full`}
          />
        </span>
        <span className="text-[10px] uppercase tracking-wider font-medium text-emerald-700 dark:text-emerald-400">
          {isWorking ? 'Connecting' : 'Recording'}
        </span>
        <span className="ml-auto text-[10px] font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatTime(seconds)}
        </span>
      </div>
      <div className="mt-1 text-[12px] text-neutral-800 dark:text-neutral-100 truncate leading-tight">
        {activeTitle || 'Untitled meeting'}
      </div>
    </button>
  )
}
