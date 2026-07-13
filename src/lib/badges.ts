/* eslint-disable @typescript-eslint/no-explicit-any */

// Merqt's trust badge system (see design brief). Only badges backed by a real
// data signal are ever computed - there is no schema support yet for
// "visited", "fast responder", "licensed", "repeat buyers" or "quick delivery",
// so those are intentionally omitted rather than faked.
export type Tone = 'success' | 'indigo' | 'ochre'
export type TrustBadge = { key: string; label: string; tone: Tone }

const RISING_WINDOW_DAYS = 90

export function computeTrustBadges(seller: any): TrustBadge[] {
  const badges: TrustBadge[] = []

  if (seller.verified) {
    badges.push({ key: 'identity', label: 'Identity verified', tone: 'success' })
  }
  if (seller.google_place_id) {
    badges.push({ key: 'location', label: 'Location verified', tone: 'success' })
  }
  if (seller.order_count >= 100 && Number(seller.rating) >= 4.5) {
    badges.push({ key: 'topSeller', label: 'Top seller', tone: 'ochre' })
  } else if (seller.created_at) {
    const ageDays = (Date.now() - new Date(seller.created_at).getTime()) / (24 * 60 * 60 * 1000)
    if (ageDays <= RISING_WINDOW_DAYS && seller.order_count >= 5 && Number(seller.rating) >= 4) {
      badges.push({ key: 'rising', label: 'Rising', tone: 'indigo' })
    }
  }

  return badges
}

export const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-merqt-success-soft text-merqt-success-dark',
  indigo: 'bg-merqt-indigo-soft text-merqt-indigo-dark',
  ochre: 'bg-merqt-ochre-soft text-merqt-ochre-dark',
}
