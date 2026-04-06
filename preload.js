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
})
