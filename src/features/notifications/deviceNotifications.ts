/**
 * The pop-ups the device itself shows while Mise is running. Reaching a closed
 * app is Web Push's job (`push.ts`). Whatever reaches neither waits in the bell.
 */
export type DevicePermission = NotificationPermission | 'unsupported'

export function devicePermission(): DevicePermission {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

/** Browsers only ask from a tap or a click, so call this straight from one. */
export async function askForDeviceNotifications(): Promise<DevicePermission> {
  const permission = devicePermission()
  return permission === 'default' ? Notification.requestPermission() : permission
}

export async function showDeviceNotification(
  title: string,
  { body, tag, to, onOpen }: { body: string; tag: string; to: string; onOpen: () => void },
): Promise<void> {
  const options: NotificationOptions = { body, tag, icon: '/favicon.svg', data: { to } }
  // Phones refuse `new Notification`, so the service worker has to show it where
  // there is one (see `public/sw-notifications.js`). The dev server has none.
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration?.active) return registration.showNotification(title, options)

  const notification = new Notification(title, options)
  notification.onclick = () => {
    window.focus()
    notification.close()
    onOpen()
  }
}
