'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatNaira, timeAgo } from '@/lib/format'
import { Badge } from '@/components/ui/Badge'

type Tab = 'products' | 'services'
type Sort = 'default' | 'newest'

function Gallery({ images }: { images: string[] | null }) {
  const extra = (images ?? []).slice(1, 4)
  if (extra.length === 0) return null
  return (
    <div className="flex gap-1 px-3 pt-2">
      {extra.map((src, i) => (
        <div key={i} className="flex-1 aspect-square rounded bg-merqt-bg overflow-hidden">
          <img src={src} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  )
}

export function MarketplaceClient({ seller, products }: { seller: any; products: any[] }) {
  const [tab, setTab] = useState<Tab>('products')
  const [sort, setSort] = useState<Sort>('default')

  const sorted = useMemo(() => {
    if (sort === 'newest') {
      return products.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return products
  }, [products, sort])

  const physicalProducts = sorted.filter((p) => p.type === 'physical')
  const services = sorted.filter((p) => p.type === 'service')

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-4xl mx-auto">
        <Link href={`/@${seller.slug}`} className="text-[13px] font-semibold text-merqt-indigo">
          ← Back to profile
        </Link>
        <h1 className="font-serif text-[26px] font-semibold text-merqt-text mt-2.5 mb-1">
          {seller.business_name}&rsquo;s marketplace
        </h1>
        <p className="text-[13.5px] text-merqt-text-muted mb-5">{seller.category} · {seller.city}</p>

        <div className="flex items-center gap-1 mb-5 border-b border-merqt-border">
          <button
            onClick={() => setTab('products')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === 'products' ? 'text-merqt-indigo border-merqt-indigo' : 'text-merqt-text-muted border-transparent'}`}
          >
            Products ({physicalProducts.length})
          </button>
          <button
            onClick={() => setTab('services')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === 'services' ? 'text-merqt-indigo border-merqt-indigo' : 'text-merqt-text-muted border-transparent'}`}
          >
            Services ({services.length})
          </button>
          <div className="flex-1" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="px-3 py-1.5 rounded-pill text-xs font-semibold border border-merqt-border bg-merqt-surface text-merqt-text mb-2"
          >
            <option value="default">Sort: Default</option>
            <option value="newest">Sort: Newest listings</option>
          </select>
        </div>

        {tab === 'products' && (
          physicalProducts.length === 0 ? (
            <p className="text-sm text-merqt-text-muted text-center py-8">No products listed yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {physicalProducts.map((p) => (
                <Link key={p.id} href={`/order/${p.id}`}>
                  <div className="bg-merqt-surface border border-merqt-border rounded-card overflow-hidden hover:border-merqt-indigo transition-colors h-full">
                    <div className="aspect-[4/3] bg-merqt-bg">
                      {p.images?.[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />}
                    </div>
                    <Gallery images={p.images} />
                    <div className="p-3">
                      <div className="text-[13.5px] font-semibold mb-1">{p.name}</div>
                      <div className="font-mono text-sm font-semibold text-merqt-indigo mb-1.5">{formatNaira(p.price)}</div>
                      {p.negotiable && <Badge label="Offers OK" tone="ochre" />}
                      <div className="text-[11px] text-merqt-text-muted mt-1.5">Listed {timeAgo(p.created_at)}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {tab === 'services' && (
          services.length === 0 ? (
            <p className="text-sm text-merqt-text-muted text-center py-8">No services listed yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {services.map((s) => (
                <Link key={s.id} href={`/request/${s.id}`}>
                  <div className="bg-merqt-surface border border-merqt-border rounded-card p-3.5 hover:border-merqt-indigo transition-colors">
                    <div className="flex gap-3.5 items-center">
                      <div className="w-14 h-14 rounded bg-merqt-bg overflow-hidden flex-shrink-0">
                        {s.images?.[0] && <img src={s.images[0]} alt={s.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold mb-0.5">{s.name}</div>
                        {s.description && <div className="text-[13px] text-merqt-text-muted">{s.description}</div>}
                        <div className="text-[11px] text-merqt-text-muted mt-1">Listed {timeAgo(s.created_at)}</div>
                      </div>
                      <div className="font-mono text-[13.5px] font-semibold text-merqt-indigo whitespace-nowrap">
                        {s.price > 0 ? `from ${formatNaira(s.price)}` : 'Get quote'}
                      </div>
                    </div>
                    <Gallery images={s.images} />
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
