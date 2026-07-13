'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { CATEGORIES, CITIES } from '@/lib/constants'
import { getInitials, formatNaira } from '@/lib/format'
import { computeTrustBadges } from '@/lib/badges'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ensureUserRow } from '@/lib/ensureUser'
import { URGENCY_OPTIONS, urgencyClasses, urgencyLabel, respondToRequest } from '@/lib/requests'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'

const CHIP_CATEGORIES = ['All', ...CATEGORIES]
type Sort = 'recommended' | 'rating' | 'orders'
type Tab = 'requests' | 'sellers'
type ConciergeResult = { category: string | null; city: string | null; keywords: string[]; explanation: string }

export function DiscoverClient({ sellers, initialRequests }: { sellers: any[]; initialRequests: any[] }) {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('requests')

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [location, setLocation] = useState('All locations')
  const [sort, setSort] = useState<Sort>('recommended')
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  const [nlQuery, setNlQuery] = useState('')
  const [nlSearching, setNlSearching] = useState(false)
  const [nlResult, setNlResult] = useState<ConciergeResult | null>(null)

  // Buyer requests board
  const [requests, setRequests] = useState(initialRequests)
  const [requestSearch, setRequestSearch] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftCategory, setDraftCategory] = useState('')
  const [draftLocation, setDraftLocation] = useState('')
  const [draftBudget, setDraftBudget] = useState('')
  const [draftUrgency, setDraftUrgency] = useState<'urgent' | 'this_week' | 'flexible'>('flexible')
  const [posting, setPosting] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  async function reloadRequests() {
    const { data } = await supabase
      .from('buyer_requests').select('*, buyer:users(name, avatar_url)').eq('status', 'open').order('created_at', { ascending: false })
    setRequests(data ?? [])
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
        budget: draftBudget ? parseFloat(draftBudget) : null,
        urgency: draftUrgency,
      })
      setDraftDesc(''); setDraftCategory(''); setDraftLocation(''); setDraftBudget(''); setDraftUrgency('flexible')
      reloadRequests()
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
      if (conversationId) {
        router.push(`/activity?tab=messages&convo=${conversationId}`)
      } else {
        reloadRequests() // someone else claimed it first
      }
    } finally {
      setRespondingId(null)
    }
  }

  const filteredRequests = useMemo(() => {
    const q = requestSearch.toLowerCase().trim()
    if (q === '') return requests
    return requests.filter((r) =>
      r.description.toLowerCase().includes(q) ||
      (r.category && r.category.toLowerCase().includes(q)) ||
      (r.location && r.location.toLowerCase().includes(q))
    )
  }, [requests, requestSearch])

  async function runConciergeSearch() {
    if (nlQuery.trim().length < 3) return
    setNlSearching(true)
    try {
      const res = await fetch('/api/agents/concierge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: nlQuery }),
      })
      const data = await res.json()
      if (!data.error) {
        setNlResult(data)
        if (data.category) setCategory(data.category)
      }
    } catch {
      setNlResult(null)
    } finally {
      setNlSearching(false)
    }
  }

  const filteredSellers = useMemo(() => {
    const list = sellers.filter((s) => {
      const matchesCategory = category === 'All' || s.category === category
      const matchesLocation = location === 'All locations' || s.city === location
      const matchesVerified = !verifiedOnly || s.verified

      if (nlResult) {
        const matchesNlCity = !nlResult.city || s.city === nlResult.city
        const matchesNlKeywords =
          nlResult.keywords.length === 0 ||
          nlResult.keywords.some((k: string) =>
            s.business_name.toLowerCase().includes(k.toLowerCase()) ||
            s.category.toLowerCase().includes(k.toLowerCase()) ||
            (s.bio && s.bio.toLowerCase().includes(k.toLowerCase()))
          )
        return matchesCategory && matchesLocation && matchesVerified && matchesNlCity && matchesNlKeywords
      }

      const q = search.toLowerCase().trim()
      const matchesSearch =
        q === '' ||
        s.business_name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        (s.bio && s.bio.toLowerCase().includes(q))
      return matchesCategory && matchesLocation && matchesVerified && matchesSearch
    })

    return list.slice().sort((a, b) => {
      if (sort === 'rating') return Number(b.rating) - Number(a.rating)
      if (sort === 'orders') return b.order_count - a.order_count
      return 0
    })
  }, [sellers, category, location, verifiedOnly, nlResult, search, sort])

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-serif text-[28px] font-semibold text-merqt-text mb-1.5">Discover</h1>
        <p className="text-sm text-merqt-text-muted mb-5">Where buyers post what they need and sellers find work.</p>

        <div className="flex gap-1 mb-6 border-b border-merqt-border">
          <button
            onClick={() => setTab('requests')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === 'requests' ? 'text-merqt-indigo border-merqt-indigo' : 'text-merqt-text-muted border-transparent'}`}
          >
            Buyer requests
          </button>
          <button
            onClick={() => setTab('sellers')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === 'sellers' ? 'text-merqt-indigo border-merqt-indigo' : 'text-merqt-text-muted border-transparent'}`}
          >
            Browse sellers
          </button>
        </div>

        {tab === 'requests' && (
          <div>
            <input
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              placeholder="Search requests — who needs your service?"
              className="w-full mb-4 border border-merqt-border rounded px-3.5 py-2.5 text-sm bg-merqt-surface outline-none focus:border-merqt-indigo"
            />

            <Card className="p-4.5 mb-5">
              <div className="text-sm font-semibold mb-3">Post what you need</div>
              <textarea
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="What do you need help with?"
                className="w-full min-h-[56px] border border-merqt-border rounded px-3 py-2.5 text-sm outline-none focus:border-merqt-indigo resize-none mb-3"
              />
              <div className="flex gap-2.5 mb-3 flex-wrap">
                <input
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                  placeholder="Category (e.g. Catering)"
                  className="flex-1 min-w-[160px] border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
                />
                <input
                  value={draftLocation}
                  onChange={(e) => setDraftLocation(e.target.value)}
                  placeholder="Location"
                  className="flex-1 min-w-[160px] border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
                />
                <input
                  value={draftBudget}
                  onChange={(e) => setDraftBudget(e.target.value)}
                  placeholder="Budget (optional)"
                  type="number"
                  className="flex-1 min-w-[160px] border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-merqt-text-muted mr-1">Timeframe:</span>
                {URGENCY_OPTIONS.map((u) => (
                  <button
                    key={u.value}
                    onClick={() => setDraftUrgency(u.value)}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded ${draftUrgency === u.value ? urgencyClasses(u.value) : 'bg-merqt-bg border border-merqt-border text-merqt-text-muted'}`}
                  >
                    {u.label}
                  </button>
                ))}
                <div className="flex-1" />
                <Button variant="primary" disabled={posting || draftDesc.trim().length === 0} onClick={postRequest}>
                  {posting ? 'Posting...' : 'Post request'}
                </Button>
              </div>
            </Card>

            <div className="flex flex-col gap-3">
              {filteredRequests.length === 0 && (
                <Card className="p-8 text-center">
                  <p className="text-sm text-merqt-text-muted">No open requests right now.</p>
                </Card>
              )}
              {filteredRequests.map((r) => (
                <Card key={r.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar src={r.buyer?.avatar_url} name={r.buyer?.name || 'Buyer'} size={32} />
                      <div>
                        <div className="text-sm font-semibold">{r.buyer?.name || 'Buyer'}</div>
                        <div className="text-xs text-merqt-text-muted">
                          {r.location && `${r.location} · `}{new Date(r.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded whitespace-nowrap ${urgencyClasses(r.urgency)}`}>
                      {urgencyLabel(r.urgency)}
                    </span>
                  </div>
                  <p className="text-[13.5px] leading-relaxed mb-2.5">{r.description}</p>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {r.category && (
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-merqt-indigo-soft text-merqt-indigo-dark">{r.category}</span>
                    )}
                    {r.budget && <span className="text-xs text-merqt-text-muted">Budget: {formatNaira(r.budget)}</span>}
                    <div className="flex-1" />
                    <Button variant="primary" size="sm" disabled={respondingId === r.id} onClick={() => respond(r)}>
                      {respondingId === r.id ? 'Responding...' : 'I can help'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab === 'sellers' && (
          <div>
            {/* Concierge search */}
            <div className="mb-3">
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-merqt-border rounded px-4 py-2.5 text-sm bg-merqt-surface focus:outline-none focus:border-merqt-indigo"
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runConciergeSearch() }}
                  placeholder='Try "wedding photographer in Lagos" or "AC repair in Ikeja"'
                />
                <Button
                  variant="primary"
                  onClick={runConciergeSearch}
                  disabled={nlQuery.trim().length < 3 || nlSearching}
                >
                  {nlSearching ? 'Searching...' : 'Search'}
                </Button>
              </div>
              {nlResult?.explanation && (
                <p className="text-xs text-merqt-indigo-dark mt-2">{nlResult.explanation}</p>
              )}
            </div>

            <div className="mb-4">
              <input
                className="w-full border border-merqt-border rounded px-4 py-2.5 text-sm bg-merqt-surface focus:outline-none focus:border-merqt-indigo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Or just search sellers, products, services, or city"
              />
            </div>

            <div className="flex gap-2 flex-wrap items-center mb-6">
              {CHIP_CATEGORIES.map((c) => (
                <button key={c} onClick={() => { setCategory(c); setNlResult(null); setNlQuery('') }}
                  className={'text-xs px-3 py-1.5 rounded-pill border font-semibold whitespace-nowrap ' +
                    (category === c
                      ? 'bg-merqt-indigo-soft text-merqt-indigo-dark border-merqt-indigo'
                      : 'bg-merqt-surface text-merqt-text-muted border-merqt-border')}>
                  {c === 'All' ? 'All' : c.split(' and ')[0]}
                </button>
              ))}

              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="ml-auto px-3 py-1.5 rounded-pill text-xs font-semibold border border-merqt-border bg-merqt-surface text-merqt-text"
              >
                <option>All locations</option>
                {CITIES.map((c) => <option key={c}>{c}</option>)}
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="px-3 py-1.5 rounded-pill text-xs font-semibold border border-merqt-border bg-merqt-surface text-merqt-text"
              >
                <option value="recommended">Sort: Recommended</option>
                <option value="rating">Sort: Rating, high to low</option>
                <option value="orders">Sort: Most orders</option>
              </select>

              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-merqt-border bg-merqt-surface text-xs text-merqt-text cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
                Verified only
              </label>
            </div>

            <p className="text-sm text-merqt-text-muted mb-3">
              {filteredSellers.length} {filteredSellers.length === 1 ? 'seller' : 'sellers'}
              {category !== 'All' ? ' in ' + category : ''}
            </p>

            {filteredSellers.length === 0 ? (
              <Card className="p-10 text-center">
                <p className="text-sm text-merqt-text-muted">No sellers match your search yet.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSellers.map((s) => {
                  const badges = computeTrustBadges(s)
                  return (
                    <Link key={s.id} href={'/@' + s.slug}>
                      <Card className="p-4 h-full hover:border-merqt-indigo transition-colors cursor-pointer">
                        <div className="w-11 h-11 rounded bg-merqt-indigo-soft flex items-center justify-center text-merqt-indigo-dark font-semibold text-sm mb-3">
                          {getInitials(s.business_name)}
                        </div>

                        <p className="font-semibold text-[15px] mb-0.5">{s.business_name}</p>
                        <p className="text-xs text-merqt-text-muted mb-2">{s.category} · {s.city}</p>

                        {badges.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap mb-2.5">
                            {badges.slice(0, 2).map((b) => <Badge key={b.key} label={b.label} tone={b.tone} />)}
                          </div>
                        )}

                        <div className="flex gap-4 font-mono text-xs border-t border-merqt-border pt-2.5">
                          <span>{Number(s.rating).toFixed(1)} ★</span>
                          <span>{s.order_count} orders</span>
                          <span>{Math.round(s.completion_rate)}%</span>
                        </div>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
