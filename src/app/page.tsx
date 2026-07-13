'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ensureUserRow } from '@/lib/ensureUser'
import { getInitials } from '@/lib/format'
import { URGENCY_OPTIONS, urgencyClasses, urgencyLabel, respondToRequest } from '@/lib/requests'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'

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
  const [posting, setPosting] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  async function loadHome() {
    const [{ data: requestRows }, { data: postRows }, { data: sellerRows }] = await Promise.all([
      supabase.from('buyer_requests').select('*, buyer:users(name, avatar_url)').eq('status', 'open').order('created_at', { ascending: false }).limit(4),
      supabase.from('posts').select('*, author:users(name, avatar_url), seller:sellers(business_name, slug)').order('created_at', { ascending: false }).limit(5),
      supabase.from('sellers').select('*').order('rating', { ascending: false }).limit(4),
    ])
    setRequests(requestRows ?? [])
    setPosts(postRows ?? [])
    setSellers(sellerRows ?? [])
    setLoading(false)
  }

  useEffect(() => { loadHome() }, [])

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
      })
      setDraftDesc(''); setDraftCategory(''); setDraftLocation(''); setDraftUrgency('flexible')
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
                  <div className="flex items-center gap-2">
                    <Avatar src={r.buyer?.avatar_url} name={r.buyer?.name || 'Buyer'} size={26} />
                    <div className="text-[12.5px] font-semibold">{r.buyer?.name || 'Buyer'}</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap ${urgencyClasses(r.urgency)}`}>
                    {urgencyLabel(r.urgency)}
                  </span>
                </div>
                <p className="text-[12.5px] leading-relaxed mb-2">{r.description}</p>
                <div className="flex items-center gap-2">
                  {r.category && (
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded bg-merqt-indigo-soft text-merqt-indigo-dark">{r.category}</span>
                  )}
                  <div className="flex-1" />
                  <Button variant="primary" size="sm" disabled={respondingId === r.id} onClick={() => respond(r)}>
                    {respondingId === r.id ? '...' : 'I can help'}
                  </Button>
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
            <h3 className="font-serif text-base font-semibold text-merqt-text">Network feed</h3>
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
              return (
                <Card key={post.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar
                      src={isSeller ? null : post.author?.avatar_url}
                      name={authorName}
                      size={28}
                      shape={isSeller ? 'square' : 'circle'}
                    />
                    <span className="text-sm font-semibold">{authorName}</span>
                    {isSeller && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-merqt-indigo-soft text-merqt-indigo-dark">
                        Business
                      </span>
                    )}
                    <span className="text-xs text-merqt-text-muted">{timeAgoShort(post.created_at)}</span>
                  </div>
                  <p className="text-sm leading-relaxed mb-2">{post.text}</p>
                  {post.image_url && <img src={post.image_url} alt="" className="w-full rounded object-cover max-h-72" />}
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
                    <div className="w-11 h-11 rounded bg-merqt-indigo-soft flex items-center justify-center text-merqt-indigo-dark text-xs font-semibold flex-shrink-0">
                      {getInitials(s.business_name)}
                    </div>
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
