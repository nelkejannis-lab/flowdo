const { contextBridge, ipcRenderer } = require('electron')

let publicConfig = {}
try {
  publicConfig = ipcRenderer.sendSync('app:get-config-sync') || {}
} catch {
  // Web build — no Electron IPC
}

const runtimeBridge = { config: publicConfig }

// Keep mooncrew for backward compatibility; novat is the preferred alias for new code.
contextBridge.exposeInMainWorld('mooncrew', runtimeBridge)
contextBridge.exposeInMainWorld('novat', runtimeBridge)

contextBridge.exposeInMainWorld('electronUpdater', {
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, value) => callback(value)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, value) => callback(value)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, value) => callback(value)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (_event, value) => callback(value)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_event, value) => callback(value)),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
})

contextBridge.exposeInMainWorld('electronCapturer', {
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
})
