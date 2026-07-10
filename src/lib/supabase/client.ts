'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { useSession } from '@clerk/nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Attaches the logged-in Clerk user's token to every request
export function useSupabaseClient() {
  const { session } = useSession()

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: async (url, options = {}) => {
        const token = await session?.getToken()
        const headers = new Headers(options?.headers)
        if (token) headers.set('Authorization', `Bearer ${token}`)
        return fetch(url, { ...options, headers })
      },
    },
  })
}