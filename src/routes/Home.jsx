import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Record, FolderOpen, Microphone, Trash } from "@phosphor-icons/react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  listMeetings,
  saveMeeting,
  deleteMeeting,
  newMeeting,
  openGranulaFolder,
} from "../lib/store";

function formatDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(ms) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

export default function Home() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMeetings(await listMeetings());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startInstant = useCallback(async () => {
    const m = newMeeting();
    m.title = `Instant meeting — ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
    await saveMeeting(m);
    navigate(`/meetings/${m.id}?autostart=1`);
  }, [navigate]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm("Delete this meeting?")) return;
    await deleteMeeting(id);
    refresh();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden max-w-2xl mx-auto w-full">
      <header className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-white">
            Meetings
          </h1>
          <p className="text-[12px] text-neutral-500 dark:text-[#666] mt-1">
            All your recorded conversations, notes, and transcripts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openGranulaFolder}>
            <FolderOpen size={14} /> Open folder
          </Button>
          <Button variant="destructive" size="sm" onClick={startInstant}>
            <Record size={14} weight="fill" /> Start Instant Meeting
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <p className="text-[12px] text-neutral-400 dark:text-[#444]">
            Loading…
          </p>
        ) : meetings.length === 0 ? (
          <div className="mt-16 text-center">
            <Microphone
              size={44}
              className="mx-auto text-neutral-300 dark:text-[#2a2a2a]"
            />
            <p className="text-neutral-500 dark:text-[#777] text-sm mt-3">
              No meetings yet.
            </p>
            <p className="text-neutral-400 dark:text-[#444] text-xs mt-1">
              Hit{" "}
              <span className="text-neutral-600 dark:text-[#888]">
                Start Instant Meeting
              </span>{" "}
              to record your first one.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {meetings.map((m) => (
              <Card
                key={m.id}
                onClick={() => navigate(`/meetings/${m.id}`)}
                className="cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] text-neutral-900 dark:text-white truncate">
                      {m.title || "Untitled meeting"}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-[#555] mt-1">
                      {formatDate(m.createdAt)} · {formatDuration(m.durationMs)}{" "}
                      · {m.transcript?.length ?? 0} lines
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(m.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-500 dark:text-[#666] hover:text-red-500 p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-[#1a1a1a]"
                    title="Delete"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
