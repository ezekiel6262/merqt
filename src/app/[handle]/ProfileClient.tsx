'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'
import { getInitials } from '@/lib/format'
import { computeTrustBadges } from '@/lib/badges'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Stat } from '@/components/ui/Stat'

const STRIPE_BG =
  'repeating-linear-gradient(45deg, oklch(0.92 0.03 265), oklch(0.92 0.03 265) 10px, oklch(0.995 0.004 70) 10px, oklch(0.995 0.004 70) 20px)'

export function ProfileClient({ seller, reviews }: { seller: any; reviews: any[] }) {
  const { user, isSignedIn } = useUser()
  const supabase = useSupabaseClient()
  const [isOwnProfile, setIsOwnProfile] = useState(false)

  useEffect(() => {
    async function checkOwnership() {
      if (!user) return
      const { data: userRow } = await supabase.from('users').select('id').eq('clerk_id', user.id).single()
      if (!userRow) return
      const { data: sellerRow } = await supabase.from('sellers').select('id').eq('user_id', userRow.id).single()
      if (sellerRow?.id === seller.id) setIsOwnProfile(true)
    }
    if (isSignedIn) checkOwnership()
  }, [user, isSignedIn])

  const badges = computeTrustBadges(seller)
  const waLink = seller.whatsapp
    ? `https://wa.me/${seller.whatsapp.replace(/\D/g, '')}?text=Hi, I found you on Merqt`
    : null

  const starCounts = [5, 4, 3, 2, 1].map((star) => reviews.filter((r) => r.rating === star).length)
  const total = reviews.length || 1

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-3xl mx-auto">

        <div className="bg-merqt-surface border border-merqt-border rounded-card overflow-hidden">
          <div className="h-16" style={{ background: STRIPE_BG }} />
          <div className="p-6">
            <div className="flex justify-between items-start gap-4 mb-4 flex-wrap">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-card bg-merqt-indigo-soft flex items-center justify-center text-merqt-indigo-dark text-xl font-semibold flex-shrink-0">
                  {getInitials(seller.business_name)}
                </div>
                <div>
                  <h1 className="font-serif text-2xl font-semibold text-merqt-text leading-tight mb-1">{seller.business_name}</h1>
                  <div className="text-sm text-merqt-text-muted">{seller.category} · {seller.city}</div>
                </div>
              </div>

              <div className="flex gap-2.5 items-center">
                {isOwnProfile ? (
                  <div className="flex items-center text-[11.5px] font-bold tracking-wide text-merqt-indigo-dark bg-merqt-indigo-soft px-3 h-8 rounded">
                    YOUR PUBLIC PROFILE
                  </div>
                ) : (
                  waLink && (
                    <a href={waLink} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost">Chat on WhatsApp</Button>
                    </a>
                  )
                )}
                <Link href={`/@${seller.slug}/marketplace`}>
                  <Button variant="primary">View marketplace</Button>
                </Link>
              </div>
            </div>

            {badges.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-4">
                {badges.map((b) => <Badge key={b.key} label={b.label} tone={b.tone} />)}
              </div>
            )}

            {seller.bio && <p className="text-[14.5px] leading-relaxed text-merqt-text mb-5">{seller.bio}</p>}

            <div className="flex gap-7 border-t border-merqt-border pt-4">
              <Stat value={Number(seller.rating).toFixed(1)} label="rating" />
              <Stat value={seller.order_count} label="orders" />
              <Stat value={`${Math.round(seller.completion_rate)}%`} label="completed" />
            </div>
          </div>
        </div>

        <div className="mt-7">
          <h3 className="font-serif text-[19px] font-semibold text-merqt-text mb-3.5">Reviews</h3>

          {reviews.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-5">
              {[5, 4, 3, 2, 1].map((star, i) => {
                const pct = Math.round((starCounts[i] / total) * 100)
                return (
                  <div key={star} className="flex items-center gap-2.5 text-xs">
                    <span className="w-11 text-merqt-text-muted">{star} star</span>
                    <div className="flex-1 h-1.5 bg-merqt-border rounded-full overflow-hidden">
                      <div className="h-full bg-merqt-ochre" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-merqt-text-muted text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}

          {reviews.length === 0 ? (
            <p className="text-sm text-merqt-text-muted">No reviews yet.</p>
          ) : (
            reviews.map((r) => (
              <div key={r.id} className="border-t border-merqt-border py-3.5">
                <div className="flex justify-between mb-1.5">
                  <div className="font-semibold text-[13.5px]">{r.buyer?.name || 'Buyer'}</div>
                  <div className="text-xs text-merqt-text-muted">
                    {new Date(r.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="flex gap-2 items-center mb-1.5">
                  <span className="font-mono text-[13px] text-merqt-ochre-dark">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  <span className="text-[11px] text-merqt-success-dark bg-merqt-success-soft px-2 py-0.5 rounded">Verified purchase</span>
                </div>
                {r.body && <p className="text-[13.5px] leading-relaxed text-merqt-text">{r.body}</p>}
                {r.product?.name && (
                  <p className="text-xs text-merqt-text-muted mt-1">Purchased: {r.product.name}</p>
                )}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  )
}
