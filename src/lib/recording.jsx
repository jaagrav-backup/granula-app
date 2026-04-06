import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import NoteTaker from "notetaker";
import { getKeys, getMeeting, saveMeeting } from "./store";
import { generateNotesStream } from "./gemini";

/**
 * Global recording context.
 *
 * The notetaker instance and all associated state (messages, interim,
 * timer, active meeting) live HERE — not inside the Meeting route — so
 * they survive navigation. Switching routes no longer kills the recording
 * or desyncs the UI from the SDK.
 *
 * The Meeting page reads `activeMeetingId` and the transcript slices from
 * here, so if you navigate away and back, the same recording picks up
 * exactly where it left off. We also reconcile with `notetaker.getStatus()`
 * on consumer mount to catch any drift.
 */

const RecordingContext = createContext(null);

export function RecordingProvider({ children }) {
  // Which meeting is currently being recorded (null when idle)
  const [activeMeetingId, setActiveMeetingId] = useState(null);
  const [activeTitle, setActiveTitle] = useState("");

  const [status, setStatus] = useState({ text: "Ready", type: "idle" }); // {text,type}
  const [seconds, setSeconds] = useState(0);

  const [messages, setMessages] = useState([]);
  const [interim, setInterim] = useState({ system: "", microphone: "" });

  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // Live streamed notes text — consumed by the Meeting page to render
  // tokens as they arrive. Scoped to a meeting id so other meetings don't
  // accidentally see a partial stream.
  const [streamingNotesMeetingId, setStreamingNotesMeetingId] = useState(null);
  const [streamingNotesText, setStreamingNotesText] = useState("");

  // Bumped every time we persist a meeting from inside the provider, so
  // consumer pages can re-read from disk without racing state updates.
  const [refreshVersion, setRefreshVersion] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshVersion((v) => v + 1), []);

  const notetakerRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(null);
  const messageIdRef = useRef(0);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const startTimer = useCallback(() => {
    startedAtRef.current = Date.now();
    setSeconds(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);
  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const handleTranscript = useCallback(({ source, text, isFinal }) => {
    if (isFinal) {
      const trimmed = text.trim();
      setInterim((p) => ({ ...p, [source]: "" }));
      if (!trimmed) return;
      setMessages((p) => [
        ...p,
        { id: ++messageIdRef.current, source, text: trimmed, t: Date.now() },
      ]);
    } else {
      setInterim((p) => ({ ...p, [source]: text }));
    }
  }, []);

  // Derived: is the SDK actually recording? Source of truth = getStatus().
  const isRecording = useCallback(() => {
    const nt = notetakerRef.current;
    if (!nt || typeof nt.getStatus !== "function") return false;
    const s = nt.getStatus();
    return s === "recording" || s === "connecting";
  }, []);

  const startRecording = useCallback(
    async (meeting) => {
      if (notetakerRef.current && isRecording()) {
        console.warn("[recording] already recording, ignoring start request");
        return;
      }
      setGenError("");
      const keys = await getKeys();
      if (!keys.deepgram) {
        setStatus({
          text: "Add a Deepgram key in Settings first",
          type: "idle",
        });
        return;
      }

      // Seed messages from the existing transcript so the UI picks up where
      // the stored meeting left off (no flicker on navigation back).
      const seeded = (meeting.transcript || []).map((t, i) => ({
        id: i + 1,
        ...t,
      }));
      messageIdRef.current = seeded.length;
      setMessages(seeded);
      setInterim({ system: "", microphone: "" });
      setActiveMeetingId(meeting.id);
      setActiveTitle(meeting.title || "Untitled meeting");

      const nt = NoteTaker({
        transcription: {
          provider: "deepgram",
          apiKey: keys.deepgram,
          options: {
            model: "nova-3",
            language: "multi",
            smart_format: true,
            interim_results: true,
            profanity_filter: false,
            endpointing: 300,
          },
        },
        sources: ["system", "microphone"],
        mic: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        autoReconnectMic: true,
        dedupCrossSource: true,
        // System-audio-aware mic gate. Ducks the mic whenever the remote
        // party's voice is coming out of the speakers, so we don't
        // double-transcribe meetings on laptop speakers. Tuned a touch
        // more aggressive than the SDK default (0.01) because Deepgram's
        // nova-3 will happily pick up very quiet speaker bleed.
        micGate: {
          threshold: 0.015,
          releaseMs: 300,
          rampMs: 15,
        },
      });
      notetakerRef.current = nt;

      nt.on("transcript", handleTranscript);
      nt.on("status", (next) => {
        if (next === "connecting")
          setStatus({ text: "Connecting…", type: "working" });
        else if (next === "recording")
          setStatus({ text: "Recording", type: "recording" });
        else if (next === "stopped")
          setStatus({ text: "Stopped", type: "idle" });
        else if (next === "error") setStatus({ text: "Error", type: "idle" });
      });
      nt.on("error", (err) => {
        console.error("[recording] notetaker error", err);
        setStatus({ text: `Error: ${err.message}`, type: "idle" });
      });

      try {
        await nt.startRecording();
        startTimer();
      } catch (err) {
        console.error(err);
        setStatus({ text: `Error: ${err.message}`, type: "idle" });
        notetakerRef.current = null;
        setActiveMeetingId(null);
      }
    },
    [handleTranscript, startTimer, isRecording],
  );

  const stopRecording = useCallback(async () => {
    stopTimer();
    setInterim({ system: "", microphone: "" });
    const nt = notetakerRef.current;
    if (nt) {
      try {
        await nt.stopRecording();
      } catch (err) {
        console.error(err);
      }
      notetakerRef.current = null;
    }

    const durationMs = startedAtRef.current
      ? Date.now() - startedAtRef.current
      : 0;
    const finishedId = activeMeetingId;
    if (!finishedId) {
      setActiveMeetingId(null);
      setActiveTitle("");
      return;
    }

    // IMPORTANT: persist the transcript BEFORE flipping activeMeetingId →
    // null. Meeting.jsx's refetch effect watches activeMeetingId and would
    // otherwise read stale data from disk while this save is still in
    // flight, clobbering the new transcript with the old one.
    const existing = await getMeeting(finishedId);
    if (!existing) {
      setActiveMeetingId(null);
      setActiveTitle("");
      return;
    }
    let updated = {
      ...existing,
      transcript: messagesRef.current.map(({ id: _i, ...rest }) => rest),
      durationMs: (existing.durationMs || 0) + durationMs,
      status: "stopped",
    };
    await saveMeeting(updated);

    setActiveMeetingId(null);
    setActiveTitle("");
    bumpRefresh();

    // Auto-generate AI notes (best effort) — streamed.
    const keys = await getKeys();
    if (keys.gemini && updated.transcript.length > 0) {
      setGenerating(true);
      setStreamingNotesMeetingId(finishedId);
      setStreamingNotesText("");
      try {
        const notes = await generateNotesStream(
          {
            apiKey: keys.gemini,
            transcript: updated.transcript,
            scratchpad: updated.scratchpad,
            title: updated.title,
          },
          (full) => setStreamingNotesText(full),
        );
        updated = { ...updated, aiNotes: notes };
        await saveMeeting(updated);
        bumpRefresh();
      } catch (err) {
        setGenError(err.message);
      } finally {
        setGenerating(false);
        setStreamingNotesMeetingId(null);
        setStreamingNotesText("");
      }
    }
  }, [activeMeetingId, stopTimer, bumpRefresh]);

  // Manual AI notes regeneration (used by the "Generate notes" button)
  const regenerateNotes = useCallback(
    async (meeting) => {
      setGenError("");
      const keys = await getKeys();
      if (!keys.gemini) {
        setGenError("Add a Gemini API key in Settings first.");
        throw new Error("Missing Gemini key");
      }
      setGenerating(true);
      setStreamingNotesMeetingId(meeting.id);
      setStreamingNotesText("");
      try {
        // Prefer live messages if this is the active meeting, otherwise the
        // stored transcript.
        const transcript =
          activeMeetingId === meeting.id
            ? messagesRef.current.map(({ id: _i, ...rest }) => rest)
            : meeting.transcript || [];
        const notes = await generateNotesStream(
          {
            apiKey: keys.gemini,
            transcript,
            scratchpad: meeting.scratchpad,
            title: meeting.title,
          },
          (full) => setStreamingNotesText(full),
        );
        return notes;
      } catch (err) {
        setGenError(err.message);
        throw err;
      } finally {
        setGenerating(false);
        setStreamingNotesMeetingId(null);
        setStreamingNotesText("");
      }
    },
    [activeMeetingId],
  );

  const value = {
    activeMeetingId,
    activeTitle,
    setActiveTitle, // lets Meeting page sync title edits into the sidebar badge
    status,
    seconds,
    messages,
    interim,
    generating,
    genError,
    setGenError,
    startRecording,
    stopRecording,
    regenerateNotes,
    isRecording,
    streamingNotesMeetingId,
    streamingNotesText,
    refreshVersion,
  };
  return (
    <RecordingContext.Provider value={value}>
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecording() {
  const ctx = useContext(RecordingContext);
  if (!ctx)
    throw new Error("useRecording must be used inside <RecordingProvider>");
  return ctx;
}
