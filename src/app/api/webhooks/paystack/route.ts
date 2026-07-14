import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { PREMIUM_PRICE_KOBO } from '@/lib/premium'

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY ?? ''
  const expected = Buffer.from(crypto.createHmac('sha512', secret).update(rawBody).digest('hex'))
  const provided = Buffer.from(signature ?? '')
  if (provided.length !== expected.length) return false
  return crypto.timingSafeEqual(provided, expected)
}

// Resolves to a single user id only if exactly one account has this email -
// updating by a raw .eq('email', ...) would silently touch every row if
// emails ever collided, so this is the safer, narrower lookup.
async function findUniqueUserIdByEmail(admin: ReturnType<typeof createAdminClient>, email: string): Promise<string | null> {
  const { data } = await admin.from('users').select('id').eq('email', email)
  if (!data || data.length !== 1) return null
  return data[0].id
}

// Paystack calls this directly (no Clerk session) - authenticity comes from
// the HMAC signature over the raw body, not from auth(). Always return 200
// once the signature checks out, even if we didn't act on the event, so
// Paystack doesn't endlessly retry something we can't handle differently.
export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature')

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const event = payload.event
  const data = payload.data
  const admin = createAdminClient()
  const email: string | undefined = data?.customer?.email

  try {
    const userId = email ? await findUniqueUserIdByEmail(admin, email) : null

    if (userId && event === 'subscription.create') {
      await admin.from('users').update({
        premium_status: 'active',
        premium_subscription_code: data.subscription_code ?? null,
        premium_customer_code: data.customer?.customer_code ?? null,
        premium_email_token: data.email_token ?? null,
        premium_current_period_end: data.next_payment_date ?? null,
      }).eq('id', userId)
    } else if (userId && event === 'charge.success' && data.plan && data.amount === PREMIUM_PRICE_KOBO) {
      await admin.from('users').update({
        premium_status: 'active',
        premium_current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq('id', userId)
    } else if (userId && event === 'subscription.disable') {
      await admin.from('users').update({ premium_status: 'cancelled' }).eq('id', userId)
    } else if (userId && event === 'invoice.payment_failed') {
      await admin.from('users').update({ premium_status: 'past_due' }).eq('id', userId)
    }
  } catch {
    // best-effort - see comment above
  }

  return NextResponse.json({ received: true })
}
