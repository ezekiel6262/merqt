import { createAdminClient } from '@/lib/supabase/admin'
import { ExtendedBadgeSignals } from '@/lib/badges'

// Reads orders/messages across parties to compute aggregate trust signals for
// a seller's public profile. Must run server-side only - orders/messages RLS
// scopes reads to the buyer/seller involved, not an arbitrary profile visitor,
// so this uses the service-role client the same way the agent routes do.
export async function computeExtendedBadgeSignals(sellerId: string): Promise<ExtendedBadgeSignals> {
  const admin = createAdminClient()

  const { data: orders } = await admin
    .from('orders')
    .select('buyer_id, is_service, status, created_at, delivered_at, premises_confirmed')
    .eq('seller_id', sellerId)

  const rows = orders ?? []

  const visited = rows.some((o) => o.premises_confirmed)

  const buyerCounts = new Map<string, number>()
  for (const o of rows) {
    if (o.status === 'delivered' || o.status === 'completed') {
      buyerCounts.set(o.buyer_id, (buyerCounts.get(o.buyer_id) ?? 0) + 1)
    }
  }
  const repeatBuyerCount = Array.from(buyerCounts.values()).filter((c) => c >= 2).length

  const deliveryDurations = rows
    .filter((o) => !o.is_service && o.status === 'delivered' && o.delivered_at)
    .map((o) => (new Date(o.delivered_at!).getTime() - new Date(o.created_at).getTime()) / (24 * 60 * 60 * 1000))
  const avgDeliveryDays = deliveryDurations.length >= 3
    ? deliveryDurations.reduce((a, b) => a + b, 0) / deliveryDurations.length
    : null

  const { data: conversations } = await admin
    .from('conversations')
    .select('id, buyer_id')
    .eq('seller_id', sellerId)

  let avgFirstResponseMinutes: number | null = null
  if (conversations && conversations.length > 0) {
    const { data: sellerRow } = await admin.from('sellers').select('user_id').eq('id', sellerId).single()
    const { data: messages } = await admin
      .from('messages')
      .select('conversation_id, sender_user_id, created_at')
      .in('conversation_id', conversations.map((c) => c.id))
      .order('created_at', { ascending: true })

    const responseMinutes: number[] = []
    if (sellerRow && messages) {
      for (const convo of conversations) {
        const convoMessages = messages.filter((m) => m.conversation_id === convo.id)
        const firstBuyerMsg = convoMessages.find((m) => m.sender_user_id !== sellerRow.user_id)
        if (!firstBuyerMsg) continue
        const firstSellerReply = convoMessages.find(
          (m) => m.sender_user_id === sellerRow.user_id && new Date(m.created_at) > new Date(firstBuyerMsg.created_at)
        )
        if (!firstSellerReply) continue
        responseMinutes.push(
          (new Date(firstSellerReply.created_at).getTime() - new Date(firstBuyerMsg.created_at).getTime()) / (60 * 1000)
        )
      }
    }
    if (responseMinutes.length >= 3) {
      avgFirstResponseMinutes = responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length
    }
  }

  return { visited, repeatBuyerCount, avgDeliveryDays, avgFirstResponseMinutes }
}
