import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { disableSubscription } from '@/lib/paystack'

export async function POST() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: userRow } = await admin
    .from('users').select('id, premium_status, premium_subscription_code, premium_email_token')
    .eq('clerk_id', userId).single()
  if (!userRow) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (userRow.premium_status !== 'active') {
    return NextResponse.json({ error: 'You do not have an active subscription' }, { status: 400 })
  }
  if (!userRow.premium_subscription_code || !userRow.premium_email_token) {
    return NextResponse.json({
      error: 'Your subscription is still being set up on our end - try again in a minute, or contact support.',
    }, { status: 409 })
  }

  try {
    await disableSubscription({ code: userRow.premium_subscription_code, token: userRow.premium_email_token })
    await admin.from('users').update({ premium_status: 'cancelled' }).eq('id', userRow.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not cancel subscription' }, { status: 500 })
  }
}
