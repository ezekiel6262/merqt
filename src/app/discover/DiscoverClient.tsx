'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CATEGORIES, CITIES } from '@/lib/constants'
import { getInitials } from '@/lib/format'
import { computeTrustBadges } from '@/lib/badges'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const CHIP_CATEGORIES = ['All', ...CATEGORIES]
type Sort = 'recommended' | 'rating' | 'orders'
type ConciergeResult = { category: string | null; city: string | null; keywords: string[]; explanation: string }

export function DiscoverClient({ sellers }: { sellers: any[] }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [location, setLocation] = useState('All locations')
  const [sort, setSort] = useState<Sort>('recommended')
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  const [nlQuery, setNlQuery] = useState('')
  const [nlSearching, setNlSearching] = useState(false)
  const [nlResult, setNlResult] = useState<ConciergeResult | null>(null)

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

  const filtered = useMemo(() => {
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
        <p className="text-sm text-merqt-text-muted mb-6">Browse trusted sellers across Nigeria.</p>

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

        {/* Plain keyword search bar */}
        <div className="mb-4">
          <input
            className="w-full border border-merqt-border rounded px-4 py-2.5 text-sm bg-merqt-surface focus:outline-none focus:border-merqt-indigo"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Or just search sellers, products, services, or city"
          />
        </div>

        {/* Filter row: category chips, location, sort, verified-only */}
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

        {/* Result count */}
        <p className="text-sm text-merqt-text-muted mb-3">
          {filtered.length} {filtered.length === 1 ? 'seller' : 'sellers'}
          {category !== 'All' ? ' in ' + category : ''}
        </p>

        {/* Seller grid */}
        {filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-merqt-text-muted">No sellers match your search yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => {
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
    </div>
  )
}
