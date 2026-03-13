'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface EditorInfo {
  userId: string
  name: string
}

/**
 * Tracks who is currently editing the lineup for a given match via Supabase Realtime Presence.
 * Only users who have called claimEdit() appear as active editors.
 * Presence is automatically cleared when the browser tab closes or the user disconnects.
 */
export function useLineupPresence(matchId: number | null) {
  const [activeEditor, setActiveEditor] = useState<EditorInfo | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const myUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!matchId) {
      setActiveEditor(null)
      return
    }

    let channel: RealtimeChannel
    let cancelled = false

    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      const user = data.user;
      if (!user || cancelled) return

      myUserIdRef.current = user.id

      channel = supabase.channel(`lineup-edit:${matchId}`, {
        config: { presence: { key: user.id } },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState<{ name: string }>()

          const otherEditors = Object.entries(state)
            .filter(([key]) => key !== user.id)
            .flatMap(([userId, presences]) =>
              presences.map(p => ({ userId, name: p.name }))
            )

          setActiveEditor(otherEditors.length > 0 ? otherEditors[0] : null)
        })
        .subscribe()

      channelRef.current = channel
    })

    return () => {
      cancelled = true
      channel?.unsubscribe()
      channelRef.current = null
      myUserIdRef.current = null
      setActiveEditor(null)
    }
  }, [matchId])

  const claimEdit = async (name: string) => {
    if (!channelRef.current) return
    await channelRef.current.track({ name })
  }

  const releaseEdit = async () => {
    if (!channelRef.current) return
    await channelRef.current.untrack()
  }

  return { activeEditor, claimEdit, releaseEdit }
}
