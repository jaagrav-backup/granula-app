import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import NoteTaker from "notetaker-sdk";

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * A single chat bubble. System audio is left-aligned (muted gray),
 * microphone is right-aligned (accent red). Interim bubbles render
 * slightly faded to signal they're still being transcribed.
 */
function Bubble({ source, text, isInterim }) {
  const isMic = source === "microphone";
  const align = isMic ? "justify-end" : "justify-start";
  const colors = isMic
    ? "bg-red-600/80 text-white"
    : "bg-[#1f1f1f] text-[#e8e8e8] border border-[#2a2a2a]";
  const corners = isMic
    ? "rounded-2xl rounded-br-md"
    : "rounded-2xl rounded-bl-md";

  return (
    <div className={`flex ${align}`}>
      <div
        className={`max-w-[75%] px-3.5 py-2 text-[13px] leading-snug break-words select-text ${colors} ${corners} ${
          isInterim ? "opacity-50" : ""
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function SourceLabel({ source }) {
  const isMic = source === "microphone";
  return (
    <div
      className={`text-[10px] uppercase tracking-wider text-[#555] px-1 ${
        isMic ? "text-right" : "text-left"
      }`}
    >
      {isMic ? "You" : "System"}
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState({ text: "Ready", type: "idle" });
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("dg_key") ?? "",
  );
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  /**
   * Chronological list of finalized transcript bubbles.
   * Each entry: { id, source: 'system'|'microphone', text }
   */
  const [messages, setMessages] = useState([]);

  /**
   * Current in-flight interim for each source. Rendered as a faded
   * bubble trailing the message list. Replaced (not appended) on
   * every interim update, and cleared when the matching final lands.
   */
  const [interim, setInterim] = useState({ system: "", microphone: "" });

  const notetakerRef = useRef(null);
  const timerRef = useRef(null);
  const scrollRef = useRef(null);
  const messageIdRef = useRef(0);

  useEffect(() => {
    localStorage.setItem("dg_key", apiKey.trim());
  }, [apiKey]);

  // Auto-scroll to the bottom whenever messages or interim text changes,
  // so the latest chat bubble is always in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, interim]);

  const startTimer = useCallback(() => {
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const handleTranscript = useCallback(({ source, text, isFinal }) => {
    if (isFinal) {
      const trimmed = text.trim();
      setInterim((prev) => ({ ...prev, [source]: "" }));
      if (!trimmed) return;
      setMessages((prev) => [
        ...prev,
        { id: ++messageIdRef.current, source, text: trimmed },
      ]);
    } else {
      setInterim((prev) => ({ ...prev, [source]: text }));
    }
  }, []);

  const startRecording = useCallback(async () => {
    const key = apiKey.trim();
    if (!key) {
      setStatus({ text: "Enter a Deepgram API key first", type: "idle" });
      return;
    }

    setMessages([]);
    setInterim({ system: "", microphone: "" });

    const notetaker = NoteTaker({
      transcription: {
        provider: "deepgram",
        apiKey: key,
        options: {
          model: "nova-3",
          language: "multi",
          smart_format: true,
          interim_results: true,
          profanity_filter: true,
          endpointing: 300,
        },
      },
      sources: ["system", "microphone"],
      autoReconnectMic: true,
    });
    notetakerRef.current = notetaker;

    notetaker.on("transcript", handleTranscript);

    notetaker.on("status", (next) => {
      if (next === "connecting") {
        setStatus({ text: "Connecting…", type: "working" });
      } else if (next === "recording") {
        setStatus({ text: "Recording…", type: "recording" });
      } else if (next === "stopped") {
        setStatus({ text: "Stopped", type: "idle" });
      }
    });

    notetaker.on("source-reconnected", ({ source }) => {
      console.log(`[app] ${source} reconnected`);
    });

    notetaker.on("error", (err) => {
      console.error("[app] notetaker error:", err);
      setStatus({ text: `Error: ${err.message}`, type: "idle" });
    });

    try {
      await notetaker.startRecording();
      setRecording(true);
      startTimer();
    } catch (err) {
      console.error("[app] start failed:", err);
      setStatus({ text: `Error: ${err.message}`, type: "idle" });
      notetakerRef.current = null;
    }
  }, [apiKey, handleTranscript, startTimer]);

  const stopRecording = useCallback(async () => {
    stopTimer();
    setInterim({ system: "", microphone: "" });

    const notetaker = notetakerRef.current;
    if (notetaker) {
      try {
        await notetaker.stopRecording();
      } catch (err) {
        console.error("[app] stop failed:", err);
      }
      notetakerRef.current = null;
    }

    setRecording(false);
  }, [stopTimer]);

  const clearTranscripts = useCallback(() => {
    setMessages([]);
    setInterim({ system: "", microphone: "" });
  }, []);

  const statusColor = {
    idle: "text-[#555]",
    recording: "text-red-500",
    working: "text-amber-500",
  }[status.type];

  /**
   * Group consecutive messages from the same source so they render
   * as a single "cluster" without repeating the source label every
   * time — exactly how iMessage/WhatsApp groups sequential messages.
   */
  const clusters = useMemo(() => {
    const out = [];
    for (const msg of messages) {
      const last = out[out.length - 1];
      if (last && last.source === msg.source) {
        last.items.push(msg);
      } else {
        out.push({ source: msg.source, items: [msg] });
      }
    }
    return out;
  }, [messages]);

  const isEmpty =
    messages.length === 0 && !interim.system && !interim.microphone;

  return (
    <div className="flex flex-col h-screen bg-[#0f0f0f] text-[#e8e8e8] overflow-hidden select-none">
      <div className="flex items-center justify-between px-[18px] pt-3.5 pb-2.5 shrink-0">
        <div
          className="text-[32px] font-extralight tracking-wider text-white"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatTime(seconds)}
        </div>
        <div className="flex gap-2 no-drag">
          <button
            onClick={clearTranscripts}
            className="bg-transparent text-[#555] border border-[#2a2a2a] px-3 py-2 rounded-lg text-xs font-medium cursor-pointer hover:text-[#888] hover:border-[#444] active:scale-[0.96] transition-all"
          >
            Clear
          </button>
          <button
            onClick={startRecording}
            disabled={recording}
            className="bg-red-600 text-white px-5 py-2 rounded-lg text-[13px] font-medium cursor-pointer active:scale-[0.96] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ● Record
          </button>
          <button
            onClick={stopRecording}
            disabled={!recording}
            className="bg-[#222] text-[#ccc] border border-[#333] px-5 py-2 rounded-lg text-[13px] font-medium cursor-pointer active:scale-[0.96] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ■ Stop
          </button>
        </div>
      </div>

      <div className="px-[18px] pb-2 shrink-0">
        <p className={`text-xs min-h-[16px] ${statusColor}`}>{status.text}</p>
      </div>

      {/* Chat transcript */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 pb-2 min-h-0 scroll-smooth"
      >
        {isEmpty ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-[#444] text-xs">
              Press Record to start transcribing.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {clusters.map((cluster, ci) => (
              <div key={ci} className="flex flex-col gap-1">
                <SourceLabel source={cluster.source} />
                {cluster.items.map((msg) => (
                  <Bubble key={msg.id} source={msg.source} text={msg.text} />
                ))}
              </div>
            ))}

            {/* Trailing interim bubbles (one per source, if any) */}
            {interim.system && (
              <div className="flex flex-col gap-1">
                <SourceLabel source="system" />
                <Bubble source="system" text={interim.system} isInterim />
              </div>
            )}
            {interim.microphone && (
              <div className="flex flex-col gap-1">
                <SourceLabel source="microphone" />
                <Bubble
                  source="microphone"
                  text={interim.microphone}
                  isInterim
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-[18px] py-2.5 shrink-0 no-drag">
        <span className="text-[11px] text-[#444] whitespace-nowrap shrink-0">
          Deepgram key
        </span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="dg_…"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md text-[#666] text-[11px] font-mono py-1.5 px-2 outline-none focus:border-[#444] focus:text-[#999] placeholder:text-[#333] select-text"
        />
      </div>
    </div>
  );
}
