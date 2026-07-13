import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrderClient } from './OrderClient'

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { offer?: string }
}) {
  const supabase = createClient()

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .eq('moderation_status', 'approved')
    .single()

  if (!product) notFound()

  const { data: seller } = await supabase
    .from('sellers')
    .select('*')
    .eq('id', product.seller_id)
    .single()

  if (!seller) notFound()

  return <OrderClient product={product} seller={seller} offerId={searchParams.offer} />
}