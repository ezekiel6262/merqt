'use client'

import { useState } from 'react'

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function formatNGN(amount: number) {
  return 'N' + amount.toLocaleString('en-NG')
}

type Tab = 'products' | 'services' | 'reviews' | 'about'


export function ProfileClient({ seller, products, reviews }: { seller: any; products: any[]; reviews: any[] }) {
  const [tab, setTab] = useState<Tab>('products')

  const physicalProducts = products.filter((p) => p.type === 'physical')
  const services = products.filter((p) => p.type === 'service')

  const waLink = seller.whatsapp
    ? `https://wa.me/${seller.whatsapp.replace(/\D/g, '')}?text=Hi, I found you on Merqt`
    : null

  return (
    <div className="min-h-screen bg-li-page py-4 px-4">
      <div className="max-w-2xl mx-auto space-y-2">

        {/* Header card */}
        <div className="bg-white border border-li-border rounded-card">
          <div className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-16 h-16 rounded-card bg-li-blue-bg flex items-center justify-center text-li-blue text-xl font-semibold flex-shrink-0">
                {getInitials(seller.business_name)}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-li-text-1 leading-tight">{seller.business_name}</h1>
                <p className="text-sm text-li-text-2">{seller.category}</p>
                <p className="text-sm text-li-text-2 mt-0.5">{seller.city}</p>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              {seller.verified && (
                <span className="text-xs px-2 py-0.5 rounded-xl border border-li-green text-li-green">Verified</span>
              )}
              <span className="text-xs px-2 py-0.5 rounded-xl border border-li-blue text-li-blue">{seller.category}</span>
            </div>

            {seller.bio && <p className="text-sm text-li-text-2 leading-relaxed mb-3">{seller.bio}</p>}

            <div className="flex gap-2">
              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                   className="px-4 py-1.5 rounded-pill border-2 border-li-blue text-li-blue font-semibold text-sm">
                  Chat
                </a>
              )}
            </div>
          </div>

          <div className="border-t border-li-border grid grid-cols-3 py-3">
            <div className="text-center">
              <span className="block text-xl font-semibold text-li-blue">{Number(seller.rating).toFixed(1)}</span>
              <span className="text-xs text-li-text-3">Rating</span>
            </div>
            <div className="text-center">
              <span className="block text-xl font-semibold text-li-text-1">{seller.order_count}</span>
              <span className="text-xs text-li-text-3">Orders</span>
            </div>
            <div className="text-center">
              <span className="block text-xl font-semibold text-li-text-1">{Math.round(seller.completion_rate)}%</span>
              <span className="text-xs text-li-text-3">Completion</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border border-li-border rounded-card">
          <div className="flex border-b border-li-border">
            {(['products', 'services', 'reviews', 'about'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm capitalize border-b-2 -mb-px ${
                  tab === t ? 'text-li-blue font-semibold border-li-blue' : 'text-li-text-2 border-transparent'
                }`}
              >
                {t === 'products' ? `Products (${physicalProducts.length})` :
                 t === 'services' ? `Services (${services.length})` :
                 t === 'reviews' ? `Reviews (${reviews.length})` : 'About'}
              </button>
            ))}
          </div>

          {tab === 'products' && (
            <div className="p-4">
              {physicalProducts.length === 0 ? (
                <p className="text-sm text-li-text-2 text-center py-4">No products listed yet.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {physicalProducts.map((p) => (
                    <a key={p.id} href={`/order/${p.id}`}
                       className="border border-li-border rounded-card overflow-hidden block hover:border-li-blue transition-colors">
                      <div className="h-24 bg-li-page">
                        {p.images && p.images.length > 0 && (
                          <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="text-sm font-semibold text-li-blue">{formatNGN(p.price)}</p>
                        {p.negotiable && (
                          <span className="text-xs px-2 py-0.5 rounded-xl border border-li-blue text-li-blue inline-block mt-1">
                            Offers OK
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'services' && (
            <div className="p-4">
              {services.length === 0 ? (
                <p className="text-sm text-li-text-2 text-center py-4">No services listed yet.</p>
              ) : (
                <div className="space-y-2">
                  {services.map((s) => (
                    <a key={s.id} href={`/request/${s.id}`}
                       className="flex items-center gap-3 border border-li-border rounded-card p-3 hover:border-li-blue transition-colors">
                      {s.images && s.images.length > 0 && (
                        <img src={s.images[0]} alt={s.name} className="w-12 h-12 object-cover rounded flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{s.name}</p>
                        {s.description && <p className="text-xs text-li-text-2">{s.description}</p>}
                        <span className="text-xs text-li-blue font-semibold">Request service</span>
                      </div>
                      <p className="text-sm font-semibold text-li-blue">
                        {s.price > 0 ? `from ${formatNGN(s.price)}` : 'Get quote'}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'reviews' && (
            <div className="divide-y divide-li-border">
              {reviews.length === 0 ? (
                <p className="p-6 text-center text-sm text-li-text-2">No reviews yet.</p>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold">{r.buyer?.name || 'Buyer'}</p>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map((s) => (
                          <span key={s} className={'text-sm ' + (s <= r.rating ? 'text-yellow-400' : 'text-li-border')}>&#9733;</span>
                        ))}
                      </div>
                    </div>
                    {r.body && <p className="text-sm text-li-text-2 leading-relaxed">{r.body}</p>}
                    {r.product?.name && (
                      <p className="text-xs text-li-text-3 mt-1">Purchased: {r.product.name}</p>
                    )}
                    <p className="text-xs text-li-green mt-1">Verified purchase</p>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'about' && (
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Business name', seller.business_name],
                  ['Category', seller.category],
                  ['City', seller.city],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-li-border last:border-0">
                    <td className="py-2.5 px-4 text-li-text-2 w-2/5">{label}</td>
                    <td className="py-2.5 px-4 font-medium">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}