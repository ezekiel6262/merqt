'use client'

import { useMemo } from 'react'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { useSession } from '@clerk/nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Attaches the logged-in Clerk user's token to every request AND to the
// realtime websocket connection (accessToken covers both, unlike a fetch
// override which only affects REST calls) so RLS applies consistently
// everywhere, including live subscriptions. Memoized per session so callers
// can safely use it as a useEffect dependency without resubscribing on every
// render.
export function useSupabaseClient() {
  const { session } = useSession()

  return useMemo(
    () =>
      createSupabaseClient(supabaseUrl, supabaseAnonKey, {
        accessToken: async () => (await session?.getToken()) ?? null,
      }),
    [session]
  )
}