/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface Window {
  electronUpdater?: {
    onUpdateAvailable: (callback: (info: any) => void) => void
    onUpdateDownloaded: (callback: (info: any) => void) => void
    onDownloadProgress: (callback: (progressObj: any) => void) => void
    onUpdateNotAvailable: (callback: (info: any) => void) => void
    onUpdateError: (callback: (err: string) => void) => void
    downloadUpdate: () => void
    installUpdate: () => void
    checkForUpdates: () => Promise<any>
  }
  electronCapturer?: {
    getDesktopSources: () => Promise<Array<{ id: string, name: string }>>
  }
}
