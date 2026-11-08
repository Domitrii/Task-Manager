// Supabase Edge Function: sends reminders to devices with Mise closed.
//
// Called every minute by a scheduled job (see README → Reminders). Needs these
// secrets (`supabase secrets set`):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  the pair from `npx web-push generate-vapid-keys`
//   VAPID_SUBJECT                        a mailto: address the push services can reach
//   CRON_SECRET                          any long random string; the job sends it
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Deploy with `supabase functions deploy send-reminders --no-verify-jwt`: the
// job proves itself with CRON_SECRET instead of a signed-in user.

import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import webpush from 'npm:web-push@3.6.7'
import { sendReminders, type DuePush } from './send.ts'

const env = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`${name} isn’t set`)
  return value
}

const database = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
})
webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

Deno.serve(async (request) => {
  if (request.headers.get('x-cron-secret') !== env('CRON_SECRET')) {
    return new Response('Not allowed', { status: 401 })
  }

  const outcome = await sendReminders({
    async due() {
      const { data, error } = await database.rpc('due_reminder_pushes')
      if (error) throw error
      return data as DuePush[]
    },
    async claim(push) {
      const { data, error } = await database
        .from('push_sent')
        .upsert({ endpoint: push.endpoint, reminder_key: push.reminder_key }, { ignoreDuplicates: true })
        .select('endpoint')
      if (error) throw error
      return data.length > 0
    },
    async release(push) {
      await database.from('push_sent').delete().eq('endpoint', push.endpoint).eq('reminder_key', push.reminder_key)
    },
    async send(push, payload) {
      await webpush.sendNotification({ endpoint: push.endpoint, keys: { p256dh: push.p256dh, auth: push.auth } }, payload, {
        // A reminder is only worth having near its time.
        TTL: 600,
        urgency: 'high',
      })
    },
    async forget(endpoint) {
      await database.from('push_subscriptions').delete().eq('endpoint', endpoint)
    },
  })

  // What was sent is only needed while a reminder could still be due.
  await database.from('push_sent').delete().lt('sent_at', new Date(Date.now() - 2 * 86_400_000).toISOString())

  return Response.json(outcome)
})
