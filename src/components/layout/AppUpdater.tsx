import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function AppUpdater() {
  const { t } = useTranslation('layout')
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!window.electronUpdater) return

    window.electronUpdater.onUpdateAvailable(() => {
      setUpdateAvailable(true)
      setVisible(true)
    })

    window.electronUpdater.onDownloadProgress((prog) => {
      setProgress(prog.percent)
    })

    window.electronUpdater.onUpdateDownloaded(() => {
      setUpdateDownloaded(true)
      setIsDownloading(false)
      setUpdateAvailable(false)
      setVisible(true)
    })
  }, [])

  if (!visible || (!updateAvailable && !updateDownloaded)) return null

  function handleDownload() {
    setIsDownloading(true)
    window.electronUpdater?.downloadUpdate()
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-4 overflow-hidden rounded-2xl bg-white/95 p-3 pr-4 shadow-apple-lg backdrop-blur-xl border border-gray-100 dark:bg-racing-900/95 dark:border-racing-800 animate-slide-up">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent dark:bg-accent/20">
        {updateDownloaded ? (
          <RefreshCw size={20} className="animate-spin-slow" />
        ) : (
          <Download size={20} className={isDownloading ? "animate-pulse" : ""} />
        )}
      </div>

      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {updateDownloaded
            ? t('appUpdater.readyTitle')
            : isDownloading
              ? t('appUpdater.downloadingTitle')
              : t('appUpdater.availableTitle')}
        </h3>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {updateDownloaded
            ? t('appUpdater.readyDesc')
            : isDownloading
              ? t('appUpdater.downloadingDesc', { progress: Math.round(progress) })
              : t('appUpdater.availableDesc')}
        </p>
      </div>

      <div className="ml-2 flex items-center gap-2">
        {updateDownloaded && (
          <button
            onClick={() => window.electronUpdater?.installUpdate()}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-accent-hover hover:scale-105 active:scale-95"
          >
            {t('appUpdater.restartNow')}
          </button>
        )}

        {updateAvailable && !isDownloading && (
          <button
            onClick={handleDownload}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-accent-hover hover:scale-105 active:scale-95"
          >
            {t('appUpdater.download')}
          </button>
        )}

        {(!updateDownloaded && !isDownloading) && (
          <button
            onClick={() => setVisible(false)}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800 dark:hover:text-gray-300"
            title={t('appUpdater.later')}
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
