import { NavLink, Outlet } from "react-router-dom";
import { Microphone, ChatCircle, Gear } from "@phosphor-icons/react";
import TitleBar from "./components/TitleBar";
import RecordingIndicator from "./components/RecordingIndicator";
import UpdateBanner from "./components/UpdateBanner";
import { cn } from "./lib/utils";
import pkg from "../package.json";

const NAV = [
  { to: "/meetings", label: "Meetings", Icon: Microphone },
  { to: "/chat", label: "Chat", Icon: ChatCircle },
  { to: "/settings", label: "Settings", Icon: Gear },
];

export default function AppShell() {
  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#0f0f0f] text-neutral-900 dark:text-[#e8e8e8] overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-56 shrink-0 border-r border-neutral-200 dark:border-[#1a1a1a] flex flex-col bg-neutral-50 dark:bg-[#0c0c0c] pt-2">
          <nav className="flex-1 px-2 flex flex-col gap-1">
            {NAV.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/meetings"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors",
                    isActive
                      ? "bg-neutral-200 dark:bg-[#181818] text-neutral-900 dark:text-white"
                      : "text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-[#ddd] hover:bg-neutral-100 dark:hover:bg-[#141414]",
                  )
                }
              >
                <Icon size={16} weight="regular" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <RecordingIndicator />
          <UpdateBanner />
          <div className="px-5 py-4 text-[10px] text-neutral-300 dark:text-[#3a3a3a]">
            v{pkg.version}
          </div>
        </aside>
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
