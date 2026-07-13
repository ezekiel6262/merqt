/* eslint-disable @typescript-eslint/no-explicit-any */

// Merqt's trust badge system (see design brief). Every badge is backed by a
// real signal - either a direct column, or an aggregate computed server-side
// from orders/messages (see computeExtendedBadgeSignals in lib/sellerStats.ts,
// which needs the service-role client since RLS scopes orders/messages reads
// to the parties involved, not a public profile visitor).
export type Tone = 'success' | 'indigo' | 'ochre'
export type TrustBadge = { key: string; label: string; tone: Tone }

const RISING_WINDOW_DAYS = 90
const REPEAT_BUYER_THRESHOLD = 3
const QUICK_DELIVERY_MAX_DAYS = 3
const FAST_RESPONSE_MAX_MINUTES = 120

export type ExtendedBadgeSignals = {
  visited: boolean
  repeatBuyerCount: number
  avgDeliveryDays: number | null
  avgFirstResponseMinutes: number | null
}

export function computeTrustBadges(seller: any, extra?: ExtendedBadgeSignals): TrustBadge[] {
  const badges: TrustBadge[] = []

  if (seller.verified) {
    badges.push({ key: 'identity', label: 'Identity verified', tone: 'success' })
  }
  if (seller.google_place_id) {
    badges.push({ key: 'location', label: 'Location verified', tone: 'success' })
  }
  if (extra?.visited) {
    badges.push({ key: 'visited', label: 'Visited', tone: 'indigo' })
  }
  if (seller.order_count >= 100 && Number(seller.rating) >= 4.5) {
    badges.push({ key: 'topSeller', label: 'Top seller', tone: 'ochre' })
  } else if (seller.created_at) {
    const ageDays = (Date.now() - new Date(seller.created_at).getTime()) / (24 * 60 * 60 * 1000)
    if (ageDays <= RISING_WINDOW_DAYS && seller.order_count >= 5 && Number(seller.rating) >= 4) {
      badges.push({ key: 'rising', label: 'Rising', tone: 'indigo' })
    }
  }
  if (extra && extra.avgFirstResponseMinutes !== null && extra.avgFirstResponseMinutes <= FAST_RESPONSE_MAX_MINUTES) {
    badges.push({ key: 'fastResponder', label: 'Fast responder', tone: 'indigo' })
  }
  if (seller.licensed) {
    badges.push({ key: 'licensed', label: 'Licensed', tone: 'success' })
  }
  if (extra && extra.repeatBuyerCount >= REPEAT_BUYER_THRESHOLD) {
    badges.push({ key: 'repeatBuyers', label: 'Repeat buyers', tone: 'ochre' })
  }
  if (extra && extra.avgDeliveryDays !== null && extra.avgDeliveryDays <= QUICK_DELIVERY_MAX_DAYS) {
    badges.push({ key: 'quickDelivery', label: 'Quick delivery', tone: 'indigo' })
  }

  return badges
}

export const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-merqt-success-soft text-merqt-success-dark',
  indigo: 'bg-merqt-indigo-soft text-merqt-indigo-dark',
  ochre: 'bg-merqt-ochre-soft text-merqt-ochre-dark',
}
