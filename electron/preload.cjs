const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronUpdater', {
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, value) => callback(value)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_event, value) => callback(value)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, value) => callback(value)),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
})

contextBridge.exposeInMainWorld('electronCapturer', {
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
})
