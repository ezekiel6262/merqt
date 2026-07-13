import { createAdminClient } from '@/lib/supabase/admin'
import { FlaggedReviewsClient } from './FlaggedReviewsClient'

export const dynamic = 'force-dynamic'

export default async function AdminReviewsPage() {
  const admin = createAdminClient()
  const { data: flagged } = await admin
    .from('reviews')
    .select('id, rating, body, photo_urls, flag_reason, created_at, buyer:users(name), seller:sellers(business_name), product:products(name)')
    .eq('flagged_suspicious', true)
    .eq('hidden', false)
    .order('created_at', { ascending: false })

  return <FlaggedReviewsClient initialReviews={flagged ?? []} />
}
