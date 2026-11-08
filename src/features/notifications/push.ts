/**
 * Reminders that reach a device with Mise closed. The browser's push service
 * delivers them; this registers the device with it and tells the server where
 * to send (`push_subscriptions`, see the `20261108120000_push_reminders`
 * migration). Without a VAPID key, a service worker or push support, reminders
 * only pop up while Mise is open.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/** iPhones and iPads only allow it once Mise is on the Home Screen. */
export function needsHomeScreen(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
  return ios && !installed
}

export function pushSupported(): boolean {
  return Boolean(PUBLIC_KEY) && 'serviceWorker' in navigator && 'PushManager' in window
}

const toBytes = (base64url: string) => {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

/** Signs this device up, or refreshes it (its time zone may have changed). True once the server has it. */
export async function registerForPush(client: SupabaseClient, teamId: string, userId: string): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted' || !PUBLIC_KEY) return false
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration?.active) return false
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(PUBLIC_KEY) as BufferSource }))
  const { endpoint, keys } = subscription.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) return false
  const { error } = await client.from('push_subscriptions').upsert(
    {
      endpoint,
      user_id: userId,
      team_id: teamId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    { onConflict: 'endpoint' },
  )
  return !error
}

/** Stops this device hearing about anyone's reminders, e.g. on signing out. Never throws. */
export async function unregisterPush(client: SupabaseClient): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager?.getSubscription()
    if (!subscription) return
    await client.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    await subscription.unsubscribe()
  } catch {
    // Offline: the server forgets the device once the push service says it's gone.
  }
}
