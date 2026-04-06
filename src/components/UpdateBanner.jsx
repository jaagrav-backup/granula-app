import { useEffect, useState } from 'react'
import { Download, ArrowClockwise } from '@phosphor-icons/react'
import { Button } from './ui/button'

/**
 * Thin banner pinned to the bottom of the sidebar that reflects the
 * auto-updater lifecycle. Silent when nothing's happening; shows progress
 * while downloading; prompts to install when an update is ready.
 */
export default function UpdateBanner() {
  const [state, setState] = useState('idle')
  // idle | checking | available | downloading | downloaded | error | none
  const [version, setVersion] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const u = window.granula?.updater
    if (!u) return
    const offs = [
      u.on('checking', () => setState('checking')),
      u.on('available', (info) => {
        setState('downloading')
        setVersion(info?.version || '')
      }),
      u.on('none', () => setState('none')),
      u.on('progress', (p) => {
        setState('downloading')
        setProgress(Math.round(p?.percent || 0))
      }),
      u.on('downloaded', (info) => {
        setState('downloaded')
        setVersion(info?.version || '')
      }),
      u.on('error', (e) => {
        setState('error')
        setError(e?.message || 'Update failed')
      }),
    ]
    return () => offs.forEach((off) => off && off())
  }, [])

  if (state === 'idle' || state === 'none' || state === 'checking') return null

  if (state === 'downloading') {
    return (
      <div className="px-4 py-2 text-[10px] text-neutral-500 dark:text-[#888] border-t border-neutral-200 dark:border-[#1a1a1a]">
        <div className="flex items-center gap-1.5">
          <Download size={11} />
          <span>Downloading update {version && `v${version}`}</span>
        </div>
        <div className="mt-1.5 h-1 bg-neutral-200 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    )
  }

  if (state === 'downloaded') {
    return (
      <div className="px-3 py-2 border-t border-neutral-200 dark:border-[#1a1a1a]">
        <p className="text-[10px] text-neutral-500 dark:text-[#888] mb-1.5">
          Update {version && `v${version}`} ready
        </p>
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={() => window.granula?.updater?.install()}
        >
          <ArrowClockwise size={11} /> Restart &amp; install
        </Button>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="px-4 py-2 text-[10px] text-red-400 border-t border-neutral-200 dark:border-[#1a1a1a]">
        Update failed: {error}
      </div>
    )
  }

  return null
}
