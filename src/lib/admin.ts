import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Single-admin gate for the identity-verification review queue. Not a full
// roles system - just enough to keep /admin/verifications and its actions
// restricted to the one person reviewing submissions for now.
const ADMIN_EMAILS = ['orimogunjeolarenwaju@gmail.com']

export async function currentUserIsAdmin(): Promise<boolean> {
  const { userId } = auth()
  if (!userId) return false

  const admin = createAdminClient()
  const { data } = await admin.from('users').select('email').eq('clerk_id', userId).single()
  if (!data?.email) return false

  return ADMIN_EMAILS.includes(data.email.toLowerCase())
}
