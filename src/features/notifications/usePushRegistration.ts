import { useEffect } from 'react'
import { useStore } from '@/data/store'
import { supabase } from '@/lib/supabase'
import { useSync } from '@/features/account/sync'
import { registerForPush } from './push'

/**
 * Keeps this device signed up for reminders while Mise is closed, once
 * notifications are allowed. Not on a shared kitchen device: those reminders
 * are the signed-in manager's own.
 */
export function usePushRegistration() {
  const sync = useSync()
  const { sharedDevice } = useStore()
  const teamId = sync?.team.id
  const userId = sync?.userId

  useEffect(() => {
    if (!supabase || !teamId || !userId || sharedDevice) return
    void registerForPush(supabase, teamId, userId).catch(() => {
      // Offline or refused: tried again next time Mise opens.
    })
  }, [teamId, userId, sharedDevice])
}
