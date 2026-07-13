/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js'

export const URGENCY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'this_week', label: 'This week' },
  { value: 'flexible', label: 'Flexible' },
] as const

export function urgencyClasses(urgency: string) {
  if (urgency === 'urgent') return 'bg-merqt-ochre-dark text-merqt-surface'
  if (urgency === 'this_week') return 'bg-merqt-indigo-soft text-merqt-indigo-dark'
  return 'bg-merqt-bg border border-merqt-border text-merqt-text-muted'
}

export function urgencyLabel(urgency: string) {
  return URGENCY_OPTIONS.find((u) => u.value === urgency)?.label ?? urgency
}

// Seller claims an open buyer request: marks it responded (first responder
// wins - the update is a no-op if another seller already claimed it), then
// starts (or reuses) a conversation with the buyer and sends a greeting.
export async function respondToRequest(
  supabase: SupabaseClient,
  request: any,
  sellerId: string,
  sellerUserId: string
): Promise<string | null> {
  const { data: claimed } = await supabase
    .from('buyer_requests')
    .update({ status: 'responded', responding_seller_id: sellerId })
    .eq('id', request.id)
    .is('responding_seller_id', null)
    .select('id')
    .single()

  if (!claimed) return null // someone else already claimed it

  const { data: existingConvo } = await supabase
    .from('conversations').select('id').eq('buyer_id', request.buyer_id).eq('seller_id', sellerId).single()

  let conversationId = existingConvo?.id
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ buyer_id: request.buyer_id, seller_id: sellerId, buyer_request_id: request.id })
      .select('id').single()
    if (error) return null
    conversationId = created.id
  }

  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_user_id: sellerUserId,
    text: `Hi, I saw your request "${request.description.slice(0, 80)}" - I can help with this.`,
  })

  return conversationId
}
