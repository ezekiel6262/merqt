import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OrderClient } from './OrderClient'

export default async function OrderPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!product) notFound()

  const { data: seller } = await supabase
    .from('sellers')
    .select('*')
    .eq('id', product.seller_id)
    .single()

  if (!seller) notFound()

  return <OrderClient product={product} seller={seller} />
}