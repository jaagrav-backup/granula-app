const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('granula', {
  meetings: {
    list: () => ipcRenderer.invoke('meetings:list'),
    get: (id) => ipcRenderer.invoke('meetings:get', id),
    save: (meeting) => ipcRenderer.invoke('meetings:save', meeting),
    delete: (id) => ipcRenderer.invoke('meetings:delete', id),
    openFolder: () => ipcRenderer.invoke('meetings:openFolder'),
  },
  keys: {
    get: () => ipcRenderer.invoke('keys:get'),
    set: (keys) => ipcRenderer.invoke('keys:set', keys),
  },
  // Subscribe to file-watcher events. Returns an unsubscribe function.
  onDataChanged: (callback) => {
    const listener = (_e, payload) => callback(payload)
    ipcRenderer.on('granula:changed', listener)
    return () => ipcRenderer.removeListener('granula:changed', listener)
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    version: () => ipcRenderer.invoke('updater:version'),
    on: (event, callback) => {
      const channel = `updater:${event}`
      const listener = (_e, payload) => callback(payload)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
  },
})
