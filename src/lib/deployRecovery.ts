const RECOVERY_FLAG = 'novat-deploy-recovery-v1'

/**
 * Recover from stale PWA caches / mismatched deploy chunks (HTML served as JS).
 * Runs at most once per tab session to avoid reload loops.
 */
export function installDeployRecovery() {
  if (typeof window === 'undefined') return

  const recover = async (reason: string) => {
    if (sessionStorage.getItem(RECOVERY_FLAG)) {
      console.error('[NOVAT] Deploy recovery already attempted:', reason)
      return
    }
    sessionStorage.setItem(RECOVERY_FLAG, '1')
    console.warn('[NOVAT] Recovering from deploy/cache mismatch:', reason)

    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // Best-effort cleanup; still reload.
    }

    window.location.reload()
  }

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    void recover('vite:preloadError')
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message =
      typeof reason === 'string'
        ? reason
        : reason instanceof Error
          ? reason.message
          : String(reason ?? '')

    if (
      /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
        message
      )
    ) {
      event.preventDefault()
      void recover(message)
    }
  })
}
