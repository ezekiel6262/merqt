import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { computeExtendedBadgeSignals } from '@/lib/sellerStats'
import { ProfileClient } from './ProfileClient'

export default async function ProfilePage({
  params,
}: {
  params: { handle: string }
}) {
  // The handle comes in as "%40zekfabrics" or "@zekfabrics" - strip the @
  const raw = decodeURIComponent(params.handle)
  const slug = raw.startsWith('@') ? raw.slice(1) : raw

  const supabase = createClient()

  const { data: seller } = await supabase
    .from('sellers')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!seller) notFound()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*, buyer:users(name), product:products(name)')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })

  const badgeSignals = await computeExtendedBadgeSignals(seller.id)

  return <ProfileClient seller={seller} reviews={reviews ?? []} badgeSignals={badgeSignals} />
}
