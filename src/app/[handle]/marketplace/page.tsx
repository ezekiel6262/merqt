import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketplaceClient } from './MarketplaceClient'

export default async function MarketplacePage({
  params,
}: {
  params: { handle: string }
}) {
  const raw = decodeURIComponent(params.handle)
  const slug = raw.startsWith('@') ? raw.slice(1) : raw

  const supabase = createClient()

  const { data: seller } = await supabase
    .from('sellers')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!seller) notFound()

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('seller_id', seller.id)
    .eq('moderation_status', 'approved')

  return <MarketplaceClient seller={seller} products={products ?? []} />
}
