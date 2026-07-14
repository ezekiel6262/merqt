'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { CldUploadWidget } from 'next-cloudinary'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ensureUserRow } from '@/lib/ensureUser'
import { URGENCY_OPTIONS, urgencyClasses, urgencyLabel, respondToRequest } from '@/lib/requests'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { PostSocialBar } from '@/components/shared/PostSocialBar'

function timeAgoShort(dateStr: string) {
  const hours = Math.floor((Date.now() - new Date(dateStr).getTime()) / (60 * 60 * 1000))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function Home() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [sellers, setSellers] = useState<any[]>([])

  const [draftDesc, setDraftDesc] = useState('')
  const [draftCategory, setDraftCategory] = useState('')
  const [draftLocation, setDraftLocation] = useState('')
  const [draftUrgency, setDraftUrgency] = useState<'urgent' | 'this_week' | 'flexible'>('flexible')
  const [draftImage, setDraftImage] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [ownUserId, setOwnUserId] = useState<string | null>(null)
  const [ownSellerId, setOwnSellerId] = useState<string | null>(null)
  const [followedSellerIds, setFollowedSellerIds] = useState<Set<string>>(new Set())
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set())

  async function loadHome() {
    const [{ data: requestRows }, { data: postRows }, { data: sellerRows }] = await Promise.all([
      supabase.from('buyer_requests').select('*, buyer:users(name, avatar_url, slug)').eq('status', 'open').order('created_at', { ascending: false }).limit(4),
      supabase.from('posts').select('*, author:users(name, avatar_url, slug), seller:sellers(business_name, slug, logo_url)').order('created_at', { ascending: false }).limit(5),
      supabase.from('sellers').select('*').order('rating', { ascending: false }).limit(4),
    ])
    setRequests(requestRows ?? [])
    setPosts(postRows ?? [])
    setSellers(sellerRows ?? [])
    setLoading(false)
  }

  useEffect(() => { loadHome() }, [])

  useEffect(() => {
    async function loadOwnUserId() {
      if (!user) return
      const { data } = await supabase.from('users').select('id').eq('clerk_id', user.id).single()
      if (!data) return
      setOwnUserId(data.id)

      const { data: sellerRow } = await supabase.from('sellers').select('id').eq('user_id', data.id).single()
      setOwnSellerId(sellerRow?.id ?? null)

      const { data: followRows } = await supabase
        .from('follows').select('seller_id, followee_user_id').eq('follower_id', data.id)
      setFollowedSellerIds(new Set((followRows ?? []).map((f: any) => f.seller_id).filter(Boolean)))
      setFollowedUserIds(new Set((followRows ?? []).map((f: any) => f.followee_user_id).filter(Boolean)))
    }
    loadOwnUserId()
  }, [user])

  async function toggleFollowSeller(sellerId: string) {
    if (!user) { router.push('/login'); return }
    const userId = await ensureUserRow(supabase, user)
    if (followedSellerIds.has(sellerId)) {
      await supabase.from('follows').delete().eq('follower_id', userId).eq('seller_id', sellerId)
      setFollowedSellerIds((prev) => { const next = new Set(prev); next.delete(sellerId); return next })
    } else {
      await supabase.from('follows').insert({ follower_id: userId, seller_id: sellerId })
      setFollowedSellerIds((prev) => new Set(prev).add(sellerId))
    }
  }

  async function toggleFollowUser(followeeUserId: string) {
    if (!user) { router.push('/login'); return }
    const userId = await ensureUserRow(supabase, user)
    if (followedUserIds.has(followeeUserId)) {
      await supabase.from('follows').delete().eq('follower_id', userId).eq('followee_user_id', followeeUserId)
      setFollowedUserIds((prev) => { const next = new Set(prev); next.delete(followeeUserId); return next })
    } else {
      await supabase.from('follows').insert({ follower_id: userId, followee_user_id: followeeUserId })
      setFollowedUserIds((prev) => new Set(prev).add(followeeUserId))
    }
  }

  async function postRequest() {
    if (!user) { router.push('/login'); return }
    if (draftDesc.trim().length === 0) return
    setPosting(true)
    try {
      const userId = await ensureUserRow(supabase, user)
      await supabase.from('buyer_requests').insert({
        buyer_id: userId,
        description: draftDesc.trim(),
        category: draftCategory || null,
        location: draftLocation || null,
        urgency: draftUrgency,
        image_url: draftImage,
      })
      setDraftDesc(''); setDraftCategory(''); setDraftLocation(''); setDraftUrgency('flexible'); setDraftImage(null)
      loadHome()
    } finally {
      setPosting(false)
    }
  }

  async function respond(request: any) {
    if (!user) { router.push('/login'); return }
    setRespondingId(request.id)
    try {
      const userId = await ensureUserRow(supabase, user)
      const { data: sellerRow } = await supabase.from('sellers').select('id').eq('user_id', userId).single()
      if (!sellerRow) { router.push('/onboarding'); return }
      const conversationId = await respondToRequest(supabase, request, sellerRow.id, userId)
      if (conversationId) router.push(`/activity?tab=messages&convo=${conversationId}`)
      else loadHome()
    } finally {
      setRespondingId(null)
    }
  }

  if (loading) return <div className="p-10 text-merqt-text-muted">Loading...</div>

  return (
    <div className="min-h-screen bg-merqt-bg py-7 px-5">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-5">

        {/* Buyer requests */}
        <div>
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="font-serif text-base font-semibold text-merqt-text">Buyer requests</h3>
            <Link href="/discover" className="text-xs font-semibold text-merqt-indigo">See all</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {requests.length === 0 && (
              <p className="text-xs text-merqt-text-muted">No open requests right now.</p>
            )}
            {requests.map((r) => (
              <Card key={r.id} className="p-3">
                <div className="flex justify-between items-start mb-1.5">
                  {r.buyer?.slug ? (
                    <Link href={`/u/${r.buyer.slug}`} className="flex items-center gap-2">
                      <Avatar src={r.buyer?.avatar_url} name={r.buyer?.name || 'Buyer'} size={26} />
                      <div className="text-[12.5px] font-semibold">{r.buyer?.name || 'Buyer'}</div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Avatar src={r.buyer?.avatar_url} name={r.buyer?.name || 'Buyer'} size={26} />
                      <div className="text-[12.5px] font-semibold">{r.buyer?.name || 'Buyer'}</div>
                    </div>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${urgencyClasses(r.urgency)}`}>
                    {urgencyLabel(r.urgency)}
                  </span>
                </div>
                <p className="text-[12.5px] leading-relaxed mb-2">{r.description}</p>
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt="" className="w-full max-h-48 object-cover rounded mb-2" />
                )}
                <div className="flex items-center gap-2">
                  {r.category && (
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded bg-merqt-indigo-soft text-merqt-indigo-dark">{r.category}</span>
                  )}
                  <div className="flex-1" />
                  {r.buyer_id === ownUserId ? (
                    <span className="text-xs text-merqt-text-muted">Your request</span>
                  ) : (
                    <Button variant="primary" size="sm" disabled={respondingId === r.id} onClick={() => respond(r)}>
                      {respondingId === r.id ? '...' : 'I can help'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Composer + feed */}
        <div>
          <Card className="p-4 mb-4">
            <div className="text-sm font-semibold mb-2.5">Post what you need</div>
            <textarea
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              placeholder="What do you need help with?"
              className="w-full min-h-[50px] border border-merqt-border rounded px-3 py-2.5 text-sm outline-none focus:border-merqt-indigo resize-none mb-2.5"
            />
            <div className="flex gap-2 mb-2.5 flex-wrap">
              <input value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)} placeholder="Category"
                className="flex-1 min-w-[100px] border border-merqt-border rounded px-2.5 py-2 text-[13px] outline-none focus:border-merqt-indigo" />
              <input value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} placeholder="Location"
                className="flex-1 min-w-[100px] border border-merqt-border rounded px-2.5 py-2 text-[13px] outline-none focus:border-merqt-indigo" />
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-2.5">
              <CldUploadWidget uploadPreset="merqt_products" onSuccess={(result: any) => setDraftImage(result.info.secure_url)}>
                {({ open }) => (
                  <button
                    type="button"
                    onClick={() => open()}
                    className="border border-dashed border-merqt-border text-merqt-text-muted rounded px-2.5 py-1.5 text-xs font-semibold"
                  >
                    {draftImage ? '✓ Photo added' : '+ Photo'}
                  </button>
                )}
              </CldUploadWidget>
              {draftImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draftImage} alt="" className="w-9 h-9 object-cover rounded border border-merqt-border" />
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {URGENCY_OPTIONS.map((u) => (
                <button
                  key={u.value}
                  onClick={() => setDraftUrgency(u.value)}
                  className={`text-[11px] font-semibold px-2 py-1 rounded ${draftUrgency === u.value ? urgencyClasses(u.value) : 'bg-merqt-bg border border-merqt-border text-merqt-text-muted'}`}
                >
                  {u.label}
                </button>
              ))}
              <div className="flex-1" />
              <Button variant="primary" size="sm" disabled={posting || draftDesc.trim().length === 0} onClick={postRequest}>
                {posting ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </Card>

          <div className="flex justify-between items-baseline mb-3">
            <h3 className="font-serif text-base font-semibold text-merqt-text">The Weave</h3>
            <Link href="/network" className="text-xs font-semibold text-merqt-indigo">See all</Link>
          </div>
          <div className="flex flex-col gap-3.5">
            {posts.length === 0 && (
              <Card className="p-6 text-center">
                <p className="text-sm text-merqt-text-muted">No posts yet.</p>
              </Card>
            )}
            {posts.map((post) => {
              const isSeller = !!post.seller_id
              const authorName = isSeller ? post.seller?.business_name : post.author?.name || 'Buyer'
              const profileHref = isSeller
                ? post.seller?.slug ? `/@${post.seller.slug}` : null
                : post.author?.slug ? `/u/${post.author.slug}` : null
              const authorAvatar = (
                <Avatar
                  src={isSeller ? post.seller?.logo_url : post.author?.avatar_url}
                  name={authorName}
                  size={28}
                  shape={isSeller ? 'square' : 'circle'}
                />
              )
              const isOwnPost = isSeller ? post.seller_id === ownSellerId : post.author_user_id === ownUserId
              const isFollowingAuthor = isSeller ? followedSellerIds.has(post.seller_id) : followedUserIds.has(post.author_user_id)
              return (
                <Card key={post.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {profileHref ? (
                      <Link href={profileHref} className="flex items-center gap-2">
                        {authorAvatar}
                        <span className="text-sm font-semibold">{authorName}</span>
                      </Link>
                    ) : (
                      <>
                        {authorAvatar}
                        <span className="text-sm font-semibold">{authorName}</span>
                      </>
                    )}
                    {isSeller && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-merqt-indigo-soft text-merqt-indigo-dark">
                        Business
                      </span>
                    )}
                    <span className="text-xs text-merqt-text-muted">{timeAgoShort(post.created_at)}</span>
                    <div className="flex-1" />
                    {!isOwnPost && (isSeller ? post.seller_id : post.author_user_id) && (
                      <button
                        onClick={() => isSeller ? toggleFollowSeller(post.seller_id) : toggleFollowUser(post.author_user_id)}
                        className={`rounded px-2.5 py-1 text-[11px] font-semibold flex-shrink-0 ${isFollowingAuthor ? 'border border-merqt-border text-merqt-text-muted' : 'bg-merqt-indigo text-merqt-surface'}`}
                      >
                        {isFollowingAuthor ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed mb-2">{post.text}</p>
                  {post.image_url && <img src={post.image_url} alt="" className="w-full rounded object-cover max-h-72" />}
                  <PostSocialBar postId={post.id} />
                </Card>
              )
            })}
          </div>
        </div>

        {/* Sellers */}
        <div>
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="font-serif text-base font-semibold text-merqt-text">Sellers</h3>
            <Link href="/discover" className="text-xs font-semibold text-merqt-indigo">See all</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {sellers.map((s) => (
              <Link key={s.id} href={`/@${s.slug}`}>
                <Card className="p-3 hover:border-merqt-indigo transition-colors">
                  <div className="flex gap-2.5 items-center mb-2">
                    <Avatar src={s.logo_url} name={s.business_name} size={44} shape="square" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold truncate">{s.business_name}</div>
                      <div className="text-[11.5px] text-merqt-text-muted truncate">{s.category} · {s.city}</div>
                    </div>
                  </div>
                  <div className="flex gap-3 font-mono text-[11.5px] text-merqt-text-muted">
                    <span>{Number(s.rating).toFixed(1)} ★</span>
                    <span>{s.order_count} orders</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
          <Link href="/onboarding" className="block text-[12.5px] font-semibold text-merqt-indigo mt-3.5">
            Become a seller →
          </Link>
        </div>

      </div>
    </div>
  )
}
