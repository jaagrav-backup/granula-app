import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './App'
import { ThemeProvider } from './lib/theme'
import { RecordingProvider } from './lib/recording'
import Home from './routes/Home'
import Meeting from './routes/Meeting'
import Chat from './routes/Chat'
import Settings from './routes/Settings'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
    <RecordingProvider>
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/meetings" replace />} />
          <Route path="/meetings" element={<Home />} />
          <Route path="/meetings/:id" element={<Meeting />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
    </RecordingProvider>
    </ThemeProvider>
  </StrictMode>
)
