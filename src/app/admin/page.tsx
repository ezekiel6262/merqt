import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

async function count(admin: ReturnType<typeof createAdminClient>, table: string, filters: Record<string, string | boolean>) {
  let query = admin.from(table).select('id', { count: 'exact', head: true })
  for (const [col, val] of Object.entries(filters)) query = query.eq(col, val)
  const { count: n } = await query
  return n ?? 0
}

export default async function AdminOverviewPage() {
  const admin = createAdminClient()

  const [pendingVerifications, flaggedReviews, flaggedListings, openDisputes, pendingPayouts, totalSellers, totalOrders] = await Promise.all([
    count(admin, 'sellers', { identity_status: 'pending' }),
    count(admin, 'reviews', { flagged_suspicious: true, hidden: false }),
    count(admin, 'products', { moderation_status: 'flagged' }),
    count(admin, 'orders', { dispute_status: 'reported' }),
    count(admin, 'orders', { payment_status: 'released', payout_status: 'pending' }),
    count(admin, 'sellers', {}),
    count(admin, 'orders', {}),
  ])

  const cards = [
    { label: 'Pending verifications', value: pendingVerifications, href: '/admin/verifications' },
    { label: 'Flagged reviews', value: flaggedReviews, href: '/admin/reviews' },
    { label: 'Flagged listings', value: flaggedListings, href: '/admin/listings' },
    { label: 'Open disputes', value: openDisputes, href: '/admin/disputes' },
    { label: 'Pending payouts', value: pendingPayouts, href: '/admin/payouts' },
  ]

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-2xl font-semibold text-merqt-text mb-1">Admin overview</h1>
        <p className="text-sm text-merqt-text-muted mb-6">
          {totalSellers} sellers · {totalOrders} orders on the platform
        </p>

        <div className="grid grid-cols-2 gap-3.5">
          {cards.map((c) => (
            <Link key={c.href} href={c.href}>
              <Card className="p-4 hover:border-merqt-indigo transition-colors">
                <p className="font-mono text-2xl font-semibold text-merqt-indigo mb-1">{c.value}</p>
                <p className="text-sm text-merqt-text-muted">{c.label}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
