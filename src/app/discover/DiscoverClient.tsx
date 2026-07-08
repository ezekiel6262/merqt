'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react'
import Link from 'next/link'

const CATEGORIES = [
  'All',
  'Fashion and Textiles',
  'Food and Catering',
  'Electronics and Gadgets',
  'Home Services',
  'Beauty and Wellness',
  'Creative Services',
  'Professional Services',
]

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

export function DiscoverClient({ sellers }: { sellers: any[] }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  const filtered = sellers.filter((s) => {
    const matchesCategory = category === 'All' || s.category === category
    const q = search.toLowerCase().trim()
    const matchesSearch =
      q === '' ||
      s.business_name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.city.toLowerCase().includes(q) ||
      (s.bio && s.bio.toLowerCase().includes(q))
    return matchesCategory && matchesSearch
  })

  return (
    <div className="min-h-screen bg-li-page py-4 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Search bar */}
        <div className="mb-3">
          <input
            className="w-full border border-li-border rounded px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-li-blue"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sellers, products, services, or city"
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-2 flex-wrap mb-4">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={'text-xs px-3 py-1.5 rounded-full border ' +
                (category === c
                  ? 'bg-li-blue-bg text-li-blue border-li-blue font-semibold'
                  : 'bg-white text-li-text-2 border-li-border')}>
              {c === 'All' ? 'All' : c.split(' and ')[0]}
            </button>
          ))}
        </div>

        {/* Result count */}
        <p className="text-sm text-li-text-2 mb-3">
          {filtered.length} {filtered.length === 1 ? 'seller' : 'sellers'}
          {category !== 'All' ? ' in ' + category : ''}
        </p>

        {/* Seller grid */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-li-border rounded-card p-10 text-center">
            <p className="text-sm text-li-text-2">No sellers match your search yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white border border-li-border rounded-card p-4 hover:border-li-blue transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-card bg-li-blue-bg flex items-center justify-center text-li-blue font-semibold text-sm">
                    {getInitials(s.business_name)}
                  </div>
                  {s.rating > 0 && (
                    <span className="text-xs font-semibold text-yellow-600">
                      &#9733; {Number(s.rating).toFixed(1)}
                    </span>
                  )}
                </div>

                <p className="font-semibold text-sm mb-0.5">{s.business_name}</p>
                <p className="text-xs text-li-text-2 mb-1">{s.category}</p>
                <p className="text-xs text-li-text-3 mb-3">{s.city}</p>

                <div className="grid grid-cols-2 gap-2 border-t border-li-border pt-2.5 mb-3">
                  <div className="text-center">
                    <span className="block text-sm font-semibold">{s.order_count}</span>
                    <span className="text-xs text-li-text-3">Orders</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-sm font-semibold">{Math.round(s.completion_rate)}%</span>
                    <span className="text-xs text-li-text-3">Completion</span>
                  </div>
                </div>

                <div className="flex gap-1 mb-3">
                  {s.verified && (
                    <span className="text-xs px-2 py-0.5 rounded-xl bg-li-green-bg text-li-green font-semibold">Verified</span>
                  )}
                </div>

                <Link href={'/@' + s.slug}
                  className="block w-full text-center py-1.5 rounded-pill border border-li-blue text-li-blue font-semibold text-xs">
                  View profile
                </Link>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}