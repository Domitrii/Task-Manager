// Loaded into the generated service worker (see `importScripts` in vite.config.ts).

// A reminder sent while Mise is closed (see `supabase/functions/send-reminders`).
// Its tag is the bell's key for it, so if the open app already showed it, this
// replaces that one instead of adding a second.
self.addEventListener('push', (event) => {
  let message = {}
  try {
    message = event.data ? event.data.json() : {}
  } catch {
    message = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(message.title || 'Mise', {
      body: message.body || '',
      tag: message.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { to: message.to || '/notifications' },
    }),
  )
})

// Tapping a notification brings Mise forward on the page it points to.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const to = event.notification.data?.to ?? '/notifications'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(([open]) => {
      if (!open) return self.clients.openWindow(to)
      // Separately, so a browser refusing the focus still changes the page.
      return Promise.allSettled([open.focus(), open.navigate(to)])
    }),
  )
})
