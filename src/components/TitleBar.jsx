import { Sun, Moon } from '@phosphor-icons/react'
import { useTheme } from '../lib/theme'

// Custom title bar. Fully draggable (-webkit-app-region: drag); buttons opt
// out globally in index.css. On macOS we keep the native traffic lights via
// `titleBarStyle: 'hiddenInset'` and leave spacer room for them on the left.
export default function TitleBar() {
  const { theme, toggle } = useTheme()
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0

  return (
    <div
      className="h-12 shrink-0 bg-neutral-100 dark:bg-[#0a0a0a] border-b border-neutral-200 dark:border-[#1a1a1a] flex items-center select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {isMac && <div className="w-[76px] shrink-0" />}
      <div className="flex-1 text-center text-sm text-neutral-500 dark:text-[#555] tracking-wide">
        Granula
      </div>
      <div className="flex items-center pr-3">
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="h-7 w-7 flex items-center justify-center rounded-md text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200 dark:hover:bg-[#181818] transition-colors"
        >
          {theme === 'dark' ? <Sun size={15} weight="regular" /> : <Moon size={15} weight="regular" />}
        </button>
      </div>
      {isMac && <div className="w-3 shrink-0" />}
    </div>
  )
}
