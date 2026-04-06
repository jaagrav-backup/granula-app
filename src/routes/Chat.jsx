import { ChatCircle } from '@phosphor-icons/react'

export default function Chat() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <ChatCircle size={48} className="mx-auto text-neutral-300 dark:text-[#2a2a2a]" />
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-white mt-3">Chat</h1>
        <p className="text-neutral-500 dark:text-[#666] text-sm mt-2">Coming soon.</p>
        <p className="text-neutral-400 dark:text-[#444] text-xs mt-1">
          You'll be able to chat with any of your past meetings.
        </p>
      </div>
    </div>
  )
}
