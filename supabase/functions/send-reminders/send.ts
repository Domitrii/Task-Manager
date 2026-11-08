/**
 * Sends the reminders that have just gone off. Kept apart from the Edge
 * Function's wiring (`index.ts`) so it runs anywhere with stand-ins for the
 * database and the push service.
 */

/** A reminder that's due on a device, as `due_reminder_pushes` lists them. */
export interface DuePush {
  endpoint: string
  p256dh: string
  auth: string
  reminder_key: string
  title: string
}

export interface Senders {
  due: () => Promise<DuePush[]>
  /** Marks it as sent to that device. False when another run got there first. */
  claim: (push: DuePush) => Promise<boolean>
  /** Hands it back after a failure that may pass, so the next run tries again. */
  release: (push: DuePush) => Promise<void>
  /** Sends it, throwing with the push service's `statusCode` when it says no. */
  send: (push: DuePush, payload: string) => Promise<void>
  /** Drops a device the push service says is gone: uninstalled, or permission taken away. */
  forget: (endpoint: string) => Promise<void>
}

export interface Outcome {
  sent: number
  gone: number
  failed: number
}

/** What the service worker shows, in `public/sw-notifications.js`. */
export function payloadFor(push: DuePush): string {
  return JSON.stringify({
    title: push.title,
    body: 'Tap to see what’s waiting.',
    // The bell's key, so the open app's own notification and this one replace each other.
    tag: push.reminder_key,
    to: '/notifications',
  })
}

export async function sendReminders(senders: Senders): Promise<Outcome> {
  const outcome: Outcome = { sent: 0, gone: 0, failed: 0 }
  for (const push of await senders.due()) {
    // Claimed first, so two runs at once can't both send it.
    if (!(await senders.claim(push))) continue
    try {
      await senders.send(push, payloadFor(push))
      outcome.sent += 1
    } catch (failure) {
      const status = (failure as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await senders.forget(push.endpoint)
        outcome.gone += 1
      } else {
        await senders.release(push)
        outcome.failed += 1
      }
    }
  }
  return outcome
}
