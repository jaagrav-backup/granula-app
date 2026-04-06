// Minimal Gemini client — generates structured notes from a transcript.
// Uses the official REST endpoint so we don't need an extra SDK dep.

const MODEL = 'gemini-2.5-flash'
const ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`
const STREAM_ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`

const SYSTEM_PROMPT = `You are an AI meeting notes assistant.
Generate clean, skimmable notes from the transcript below. Use this structure in Markdown:

## Summary
2-4 sentences capturing the purpose and key outcome of the conversation.

## Key Discussion Points
- Bullet points of the main topics discussed.

## Notable Details
- People, places, numbers, decisions, or context worth remembering.

## Action Items
- [ ] Concrete follow-ups (assign to a person where obvious).

## Follow-up
Any commitments, next meeting dates, or things to share afterwards.

Be concise, warm, and human. Skip sections that have no content.`

export async function generateNotes({ apiKey, transcript, scratchpad, title }) {
  if (!apiKey) throw new Error('Missing Gemini API key. Add one in Settings.')
  if (!transcript || transcript.length === 0) {
    throw new Error('No transcript to summarize yet.')
  }

  const transcriptText = transcript
    .map((t) => `${t.source === 'microphone' ? 'Me' : 'Them'}: ${t.text}`)
    .join('\n')

  const userContent = [
    `Meeting title: ${title || 'Untitled'}`,
    scratchpad ? `\nAdvisor scratchpad:\n${scratchpad}` : '',
    `\nTranscript:\n${transcriptText}`,
  ].join('')

  const res = await fetch(ENDPOINT(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: { temperature: 0.4 },
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini error (${res.status}): ${text}`)
  }
  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  return parts.map((p) => p.text || '').join('').trim()
}

function buildUserContent({ transcript, scratchpad, title }) {
  const transcriptText = transcript
    .map((t) => `${t.source === 'microphone' ? 'Me' : 'Them'}: ${t.text}`)
    .join('\n')
  return [
    `Meeting title: ${title || 'Untitled'}`,
    scratchpad ? `\nAdvisor scratchpad:\n${scratchpad}` : '',
    `\nTranscript:\n${transcriptText}`,
  ].join('')
}

/**
 * Streaming variant. Calls `onChunk(accumulatedText, deltaText)` as tokens
 * arrive and resolves to the final full text.
 */
export async function generateNotesStream({ apiKey, transcript, scratchpad, title }, onChunk) {
  if (!apiKey) throw new Error('Missing Gemini API key. Add one in Settings.')
  if (!transcript || transcript.length === 0) {
    throw new Error('No transcript to summarize yet.')
  }

  const userContent = buildUserContent({ transcript, scratchpad, title })

  console.log('[gemini] streaming start', { title, transcriptLen: transcript.length })

  const res = await fetch(STREAM_ENDPOINT(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: { temperature: 0.4 },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[gemini] stream HTTP error', res.status, text)
    throw new Error(`Gemini error (${res.status}): ${text}`)
  }
  if (!res.body) {
    console.warn('[gemini] no body stream, falling back to non-streaming')
    const notes = await generateNotes({ apiKey, transcript, scratchpad, title })
    onChunk?.(notes, notes)
    return notes
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  const flushFrame = (frame) => {
    // A frame may contain several `data:` lines; concatenate them.
    const dataLines = frame
      .split(/\r?\n/)
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).replace(/^ /, ''))
    if (dataLines.length === 0) return
    const payload = dataLines.join('\n').trim()
    if (!payload || payload === '[DONE]') return
    try {
      const json = JSON.parse(payload)
      const parts = json?.candidates?.[0]?.content?.parts ?? []
      const delta = parts.map((p) => p.text || '').join('')
      if (delta) {
        full += delta
        onChunk?.(full, delta)
      }
    } catch (e) {
      console.warn('[gemini] bad SSE frame payload', payload.slice(0, 120), e.message)
    }
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Split on blank lines (SSE frame boundaries), tolerating \r\n.
    let match
    const boundary = /\r?\n\r?\n/
    while ((match = boundary.exec(buffer))) {
      const frame = buffer.slice(0, match.index)
      buffer = buffer.slice(match.index + match[0].length)
      flushFrame(frame)
    }
  }
  // Flush any trailing frame (some servers don't send a terminating blank).
  if (buffer.trim()) flushFrame(buffer)

  // Fallback: if SSE parsing yielded nothing but we received *some* body,
  // try parsing the full response as a JSON array of GenerateContentResponse
  // (what you get without alt=sse). Accumulate and surface via onChunk so
  // the UI still updates.
  if (!full) {
    try {
      const all = (buffer || '').trim()
      const parsed = JSON.parse(all)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of arr) {
        const parts = item?.candidates?.[0]?.content?.parts ?? []
        const delta = parts.map((p) => p.text || '').join('')
        if (delta) {
          full += delta
          onChunk?.(full, delta)
        }
      }
    } catch (_e) { /* not json either */ }
  }

  console.log('[gemini] stream end', { chars: full.length })
  if (!full) {
    console.warn('[gemini] empty stream, falling back to non-streaming call')
    const notes = await generateNotes({ apiKey, transcript, scratchpad, title })
    onChunk?.(notes, notes)
    return notes
  }
  return full.trim()
}
