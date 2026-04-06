// Thin wrapper over window.granula (exposed by preload.js)
const api = () => (typeof window !== 'undefined' ? window.granula : null)

export async function listMeetings() {
  return (await api()?.meetings.list()) ?? []
}
export async function getMeeting(id) {
  return (await api()?.meetings.get(id)) ?? null
}
export async function saveMeeting(meeting) {
  return await api()?.meetings.save(meeting)
}
export async function deleteMeeting(id) {
  return await api()?.meetings.delete(id)
}
export async function openGranulaFolder() {
  return await api()?.meetings.openFolder()
}
export async function getKeys() {
  return (await api()?.keys.get()) ?? { deepgram: '', gemini: '' }
}
export async function setKeys(keys) {
  return await api()?.keys.set(keys)
}

export function newMeeting() {
  const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    title: 'Untitled meeting',
    createdAt: Date.now(),
    durationMs: 0,
    status: 'new', // new | recording | stopped
    transcript: [], // [{ source, text, t }]
    scratchpad: '',
    aiNotes: '',
  }
}
