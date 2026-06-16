export function canNotify(): boolean {
  return 'Notification' in window
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!canNotify()) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export function notify(title: string, body: string, tag?: string) {
  if (!canNotify() || Notification.permission !== 'granted') return
  new Notification(title, {
    body,
    tag,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
  })
}
