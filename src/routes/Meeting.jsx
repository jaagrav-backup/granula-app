import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  Record,
  Stop,
  Sparkle,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { Button } from "../components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";
import { getMeeting, saveMeeting } from "../lib/store";
import { useRecording } from "../lib/recording";
import Markdown from "../components/Markdown";

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ---- Chat bubble primitives (transcript panel) ----
function Bubble({ source, text, isInterim }) {
  const isMic = source === "microphone";
  return (
    <div className={cn("flex", isMic ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] px-3 py-1.5 text-[12px] leading-snug break-words select-text",
          isMic
            ? "bg-emerald-600/90 text-white rounded-2xl rounded-br-md"
            : "bg-neutral-100 dark:bg-[#1a1a1a] text-neutral-800 dark:text-[#e8e8e8] border border-neutral-200 dark:border-[#262626] rounded-2xl rounded-bl-md",
          isInterim && "opacity-50",
        )}
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
      className={cn(
        "text-[9px] uppercase tracking-wider text-neutral-400 dark:text-[#555] px-1",
        isMic ? "text-right" : "text-left",
      )}
    >
      {isMic ? "You" : "Other"}
    </div>
  );
}

export default function Meeting() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // All recording state comes from the global provider. This page no
  // longer owns the notetaker — so leaving the page doesn't stop recording
  // and coming back reconciles instantly with the SDK's actual status.
  const {
    activeMeetingId,
    setActiveTitle,
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
    streamingNotesMeetingId,
    streamingNotesText,
    refreshVersion,
  } = useRecording();

  const isActive = activeMeetingId === id;
  const isRecording =
    isActive && (status.type === "recording" || status.type === "working");

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ai");
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [scratchMode, setScratchMode] = useState("edit"); // 'edit' | 'preview'

  const scrollRef = useRef(null);
  const autostartTriedRef = useRef(false);

  // Load the stored meeting from disk on mount / id change
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getMeeting(id).then((m) => {
      if (!alive) return;
      if (!m) {
        navigate("/meetings");
        return;
      }
      setMeeting(m);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id, navigate]);

  // Autostart from Home's "Start Instant Meeting" — only once, only if not
  // already the active recording.
  useEffect(() => {
    if (loading || !meeting) return;
    if (autostartTriedRef.current) return;
    if (searchParams.get("autostart") !== "1") return;
    if (isActive) return;
    autostartTriedRef.current = true;
    startRecording(meeting);
    navigate(`/meetings/${id}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, meeting]);

  // Keep the sidebar pill's title in sync with edits on this page
  const updateTitle = useCallback(
    (title) => {
      setMeeting((m) => {
        const u = { ...m, title };
        saveMeeting(u);
        return u;
      });
      if (isActive) setActiveTitle(title);
    },
    [isActive, setActiveTitle],
  );

  const updateScratchpad = useCallback((scratchpad) => {
    setMeeting((m) => {
      const u = { ...m, scratchpad };
      saveMeeting(u);
      return u;
    });
  }, []);

  // Reload the stored meeting whenever the provider tells us something
  // has been persisted (refreshVersion bump), or when recording flips off.
  // The provider saves BEFORE clearing activeMeetingId, so by the time this
  // runs the transcript on disk is already the latest.
  useEffect(() => {
    if (!meeting || isActive) return;
    getMeeting(id).then((m) => {
      if (m) setMeeting(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMeetingId, refreshVersion]);

  // Autoscroll transcript when the active recording pushes new messages
  useEffect(() => {
    if (!isActive) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, interim, isActive]);

  const handleStart = useCallback(() => {
    if (!meeting) return;
    startRecording(meeting);
  }, [meeting, startRecording]);

  const handleStop = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  const handleGenerateNotes = useCallback(async () => {
    if (!meeting) return;
    setGenError("");
    try {
      const notes = await regenerateNotes(meeting);
      setMeeting((m) => {
        const u = { ...m, aiNotes: notes };
        saveMeeting(u);
        return u;
      });
    } catch (_err) {
      /* genError is set by the provider */
    }
  }, [meeting, regenerateNotes, setGenError]);

  // For rendering: if this meeting is active, use the live messages;
  // otherwise use whatever's stored on the meeting object.
  const displayMessages = useMemo(() => {
    if (isActive) return messages;
    return (meeting?.transcript || []).map((t, i) => ({ id: i + 1, ...t }));
  }, [isActive, messages, meeting]);

  const clusters = useMemo(() => {
    const out = [];
    for (const msg of displayMessages) {
      const last = out[out.length - 1];
      if (last && last.source === msg.source) last.items.push(msg);
      else out.push({ source: msg.source, items: [msg] });
    }
    return out;
  }, [displayMessages]);

  const liveInterim = isActive ? interim : { system: "", microphone: "" };
  const isEmpty =
    displayMessages.length === 0 &&
    !liveInterim.system &&
    !liveInterim.microphone;

  const statusText = isActive
    ? status.text
    : meeting?.status === "stopped"
      ? "Stopped"
      : "Ready";
  const statusType = isActive ? status.type : "idle";
  const statusColor = {
    idle: "text-neutral-400 dark:text-[#555]",
    recording: "text-emerald-500",
    working: "text-amber-500",
  }[statusType];

  if (loading || !meeting) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400 dark:text-[#444] text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-neutral-200 dark:border-[#1a1a1a] shrink-0">
        <div className="min-w-0 flex-1">
          <input
            value={meeting.title}
            onChange={(e) => updateTitle(e.target.value)}
            className="bg-transparent text-xl font-semibold text-neutral-900 dark:text-white outline-none w-full truncate"
          />
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-neutral-400 dark:text-[#555]">
              {new Date(meeting.createdAt).toLocaleString()}
            </span>
            <span className={cn("text-[11px]", statusColor)}>
              {isRecording
                ? `● ${statusText} · ${formatTime(seconds)}`
                : statusText}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <Button variant="destructive" onClick={handleStart}>
              <Record size={14} weight="fill" /> Record
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleStop}>
              <Stop size={14} weight="fill" /> Stop
            </Button>
          )}
        </div>
      </header>

      {/* Split view — notes (middle) | transcript (right, collapsible) */}
      <div className="flex-1 flex min-h-0">
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex-1 min-w-0 flex flex-col"
        >
          <div className="flex items-center gap-1 px-8 py-2 border-b border-neutral-200 dark:border-[#161616]">
            <TabsList>
              <TabsTrigger value="ai">AI Notes</TabsTrigger>
              <TabsTrigger value="scratch">Scratchpad</TabsTrigger>
            </TabsList>
            <div className="flex-1" />
            {tab === "ai" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateNotes}
                disabled={generating || isRecording}
              >
                <Sparkle size={12} weight="fill" />{" "}
                {generating ? "Generating…" : "Generate notes"}
              </Button>
            )}
            {!transcriptOpen && (
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={() => setTranscriptOpen(true)}
              >
                Show transcript <CaretLeft size={12} />
              </Button>
            )}
          </div>

          <TabsContent value="ai" className="overflow-y-auto px-8 py-6">
            <AiNotesView
              notes={meeting.aiNotes}
              generating={generating}
              error={genError}
              streaming={
                streamingNotesMeetingId === id ? streamingNotesText : ""
              }
            />
          </TabsContent>
          <TabsContent value="scratch" className="overflow-y-auto px-8 py-6">
            <div className="flex items-center gap-1 mb-3">
              <Button
                variant={scratchMode === "edit" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setScratchMode("edit")}
              >
                Edit
              </Button>
              <Button
                variant={scratchMode === "preview" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setScratchMode("preview")}
              >
                Preview
              </Button>
            </div>
            {scratchMode === "edit" ? (
              <Textarea
                value={meeting.scratchpad || ""}
                onChange={(e) => updateScratchpad(e.target.value)}
                placeholder="Jot down anything — names, numbers, things to follow up on… Markdown supported."
                className="min-h-[400px] h-full font-mono text-[12px]"
              />
            ) : meeting.scratchpad ? (
              <Markdown>{meeting.scratchpad}</Markdown>
            ) : (
              <p className="text-[12px] text-neutral-400 dark:text-[#555]">
                Nothing in the scratchpad yet.
              </p>
            )}
          </TabsContent>
        </Tabs>

        {transcriptOpen && (
          <aside className="w-[400px] shrink-0 border-l border-neutral-200 dark:border-[#161616] flex flex-col bg-neutral-50 dark:bg-[#0c0c0c]">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-[#161616] flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-neutral-400 dark:text-[#555]">
                Live transcript
              </span>
              <button
                onClick={() => setTranscriptOpen(false)}
                title="Collapse transcript"
                className="text-neutral-400 dark:text-[#555] hover:text-neutral-900 dark:hover:text-white p-1 rounded hover:bg-neutral-100 dark:hover:bg-[#161616]"
              >
                <CaretRight size={14} />
              </button>
            </div>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 py-3 min-h-0"
            >
              {isEmpty ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-neutral-300 dark:text-[#333] text-[11px] text-center px-6">
                    {isRecording
                      ? "Listening…"
                      : "Press Record to start transcribing both sides of the conversation."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {clusters.map((cluster, ci) => (
                    <div key={ci} className="flex flex-col gap-1">
                      <SourceLabel source={cluster.source} />
                      {cluster.items.map((msg) => (
                        <Bubble
                          key={msg.id}
                          source={msg.source}
                          text={msg.text}
                        />
                      ))}
                    </div>
                  ))}
                  {liveInterim.system && (
                    <div className="flex flex-col gap-1">
                      <SourceLabel source="system" />
                      <Bubble
                        source="system"
                        text={liveInterim.system}
                        isInterim
                      />
                    </div>
                  )}
                  {liveInterim.microphone && (
                    <div className="flex flex-col gap-1">
                      <SourceLabel source="microphone" />
                      <Bubble
                        source="microphone"
                        text={liveInterim.microphone}
                        isInterim
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function AiNotesView({ notes, generating, error, streaming }) {
  // While streaming, show the live tokens as markdown as they arrive.
  if (streaming) {
    return (
      <div>
        <p className="text-[11px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
          Streaming from Gemini…
        </p>
        <Markdown>{streaming}</Markdown>
      </div>
    );
  }
  if (generating && !notes)
    return (
      <p className="text-[12px] text-neutral-500 dark:text-[#666]">
        Generating notes with Gemini…
      </p>
    );
  if (error) return <p className="text-[12px] text-red-400">{error}</p>;
  if (!notes) {
    return (
      <div className="text-[12px] text-neutral-400 dark:text-[#555]">
        <p>No AI notes yet.</p>
        <p className="mt-1 text-neutral-400 dark:text-[#444]">
          Notes are generated automatically when you stop recording, or you can
          click{" "}
          <span className="text-neutral-500 dark:text-[#888]">
            Generate notes
          </span>{" "}
          anytime.
        </p>
      </div>
    );
  }
  return <Markdown>{notes}</Markdown>;
}
