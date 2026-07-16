import { registerSW } from 'virtual:pwa-register'
import { useToastStore } from './store/toastStore'
import i18n from './i18n'

/**
 * Web/PWA only. Electron builds disable vite-plugin-pwa (see vite.config.ts),
 * so this module is a no-op there and desktop updates stay on electron-updater.
 */
export function registerPwaUpdates() {
  if (typeof window === 'undefined') return
  if (window.electronUpdater) return

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      const t = i18n.getFixedT(null, 'layout')
      useToastStore.getState().show({
        message: t('pwaUpdate.message'),
        duration: 120_000,
        action: {
          label: t('pwaUpdate.reload'),
          onClick: () => {
            void updateSW(true)
          },
        },
      })
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      const check = () => {
        void registration.update()
      }

      // Pick up new deploys without requiring a hard refresh.
      window.setInterval(check, 60 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.addEventListener('focus', check)
    },
  })
}
