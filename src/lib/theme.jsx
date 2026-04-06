import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const KEY = 'granula.theme'
const ThemeContext = createContext({ theme: 'dark', toggle: () => {}, setTheme: () => {} })

function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    return localStorage.getItem(KEY) || 'dark'
  })

  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(KEY, theme) } catch {}
  }, [theme])

  const setTheme = useCallback((t) => setThemeState(t), [])
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
