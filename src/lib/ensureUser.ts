/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserResource } from '@clerk/types'

export async function ensureUserRow(supabase: SupabaseClient, user: UserResource): Promise<string> {
  const { data: existingUser } = await supabase
    .from('users').select('id').eq('clerk_id', user.id).single()

  if (existingUser) return existingUser.id

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      clerk_id: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? '',
      name: user.fullName ?? '',
      avatar_url: user.imageUrl ?? '',
      role: 'buyer',
    })
    .select('id').single()
  if (error) throw error
  return newUser.id
}
