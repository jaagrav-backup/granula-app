import { useEffect, useState } from 'react'
import { Check } from '@phosphor-icons/react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { getKeys, setKeys } from '../lib/store'

export default function Settings() {
  const [deepgram, setDeepgram] = useState('')
  const [gemini, setGemini] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getKeys().then((k) => {
      setDeepgram(k.deepgram || '')
      setGemini(k.gemini || '')
      setLoading(false)
    })
  }, [])

  const save = async () => {
    await setKeys({ deepgram: deepgram.trim(), gemini: gemini.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 pt-8 pb-12">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">Settings</h1>
        <p className="text-[12px] text-neutral-500 dark:text-[#666] mt-1">
          API keys are encrypted and stored locally.
        </p>

        {loading ? (
          <p className="text-neutral-400 dark:text-[#444] text-xs mt-8">Loading…</p>
        ) : (
          <div className="mt-8 flex flex-col gap-6">
            <Field
              label="Deepgram API key"
              help="Used for live speech-to-text during recordings."
              value={deepgram}
              onChange={setDeepgram}
              placeholder="dg_…"
            />
            <Field
              label="Gemini API key"
              help="Used to generate AI meeting notes from the transcript."
              value={gemini}
              onChange={setGemini}
              placeholder="AI…"
            />

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={save}>Save</Button>
              {saved && (
                <span className="inline-flex items-center gap-1 text-[12px] text-emerald-600 dark:text-emerald-400">
                  <Check size={14} weight="bold" /> Saved
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, help, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-[12px] text-neutral-600 dark:text-[#aaa] mb-1.5">{label}</label>
      <Input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="font-mono"
      />
      <p className="text-[11px] text-neutral-500 dark:text-[#555] mt-1">{help}</p>
    </div>
  )
}
