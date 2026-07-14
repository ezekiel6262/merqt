import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Paystack calls this directly (no Clerk session) - authenticity comes from
// the HMAC signature over the raw body, not from auth(). Always return 200
// once the signature checks out, even if we didn't act on the event, so
// Paystack doesn't endlessly retry something we can't handle differently.
export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature')
  const secret = process.env.PAYSTACK_SECRET_KEY ?? ''
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')

  if (!signature || signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const event = payload.event
  const data = payload.data
  const admin = createAdminClient()
  const email: string | undefined = data?.customer?.email

  try {
    if (event === 'subscription.create' && email) {
      await admin.from('users').update({
        premium_status: 'active',
        premium_subscription_code: data.subscription_code ?? null,
        premium_customer_code: data.customer?.customer_code ?? null,
        premium_email_token: data.email_token ?? null,
        premium_current_period_end: data.next_payment_date ?? null,
      }).eq('email', email)
    } else if (event === 'charge.success' && data.plan && email) {
      await admin.from('users').update({
        premium_status: 'active',
        premium_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq('email', email)
    } else if (event === 'subscription.disable' && email) {
      await admin.from('users').update({ premium_status: 'cancelled' }).eq('email', email)
    } else if (event === 'invoice.payment_failed' && email) {
      await admin.from('users').update({ premium_status: 'past_due' }).eq('email', email)
    }
  } catch {
    // best-effort - see comment above
  }

  return NextResponse.json({ received: true })
}
