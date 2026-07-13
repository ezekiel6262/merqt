'use client'
import { CldUploadWidget } from 'next-cloudinary'
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatNaira } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MetricCard } from '@/components/ui/Stat'

export default function DashboardPage() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const [seller, setSeller] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // form fields
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('physical')
  const [negotiable, setNegotiable] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')

  async function loadData() {
    if (!user) return

    const { data: userRow } = await supabase
      .from('users').select('id').eq('clerk_id', user.id).single()
    if (!userRow) { setLoading(false); return }

    const { data: sellerRow } = await supabase
      .from('sellers').select('*').eq('user_id', userRow.id).single()
    setSeller(sellerRow)

    if (sellerRow) {
      const { data: productRows } = await supabase
        .from('products').select('*').eq('seller_id', sellerRow.id)
        .order('created_at', { ascending: false })
      setProducts(productRows ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [user])

  async function addProduct() {
    if (!seller || !name || !price) return
    setSaving(true)
    setStatusMessage('')
    setError('')

    let moderationStatus = 'flagged'
    let moderationReason = ''
    try {
      const modRes = await fetch('/api/agents/moderation/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, category: seller.category, images }),
      })
      const modData = await modRes.json()

      if (modRes.status === 422 && modData.rejected) {
        // Photo/text mismatch - a fixable problem, so nothing is saved and the
        // seller can just swap the photo/text and resubmit right away.
        setError(modData.reason)
        setSaving(false)
        return
      }

      if (modData.verdict) {
        moderationStatus = modData.verdict
        moderationReason = modData.reason ?? ''
      }
    } catch {
      // moderationStatus stays 'flagged' - fail closed
    }

    const { error: insertError } = await supabase.from('products').insert({
      seller_id: seller.id,
      name,
      price: parseFloat(price),
      description: description || null,
      type,
      negotiable,
      images,
      moderation_status: moderationStatus,
    })

    if (!insertError) {
      setName(''); setPrice(''); setDescription(''); setType('physical'); setNegotiable(false); setImages([])
      setShowForm(false)
      setStatusMessage(
        moderationStatus === 'flagged'
          ? `Your listing was added and is under review before it appears publicly. Reason: ${moderationReason}`
          : 'Your listing is live.'
      )
      loadData()
    }
    setSaving(false)
  }

  if (loading) return <div className="p-10 text-merqt-text-muted">Loading...</div>
  if (!seller) return (
    <div className="p-10">
      <p className="text-merqt-text-muted">No profile found. <Link href="/onboarding" className="text-merqt-indigo font-semibold">Set one up</Link>.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h1 className="font-serif text-2xl font-semibold text-merqt-text">Your dashboard</h1>
          <Link href="/dashboard/orders"><Button variant="primary">Orders and requests</Button></Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-5">
          <MetricCard value={seller.order_count} label="Orders" />
          <MetricCard value={Number(seller.rating).toFixed(1)} label="Rating" />
          <MetricCard value={products.length} label="Listings" />
          <MetricCard value={`${Math.round(seller.completion_rate)}%`} label="Completion" />
        </div>

        <div className="flex gap-4 mb-6">
          <Link href={`/@${seller.slug}`} className="text-[13.5px] font-semibold text-merqt-indigo">View public profile →</Link>
          <Link href={`/@${seller.slug}/marketplace`} className="text-[13.5px] font-semibold text-merqt-indigo">View marketplace page →</Link>
        </div>

        <Card className="p-3.5 mb-5">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!seller.licensed}
              onChange={async (e) => {
                const licensed = e.target.checked
                setSeller((prev: any) => ({ ...prev, licensed }))
                await supabase.from('sellers').update({ licensed }).eq('id', seller.id)
              }}
            />
            My business is licensed/registered <span className="text-merqt-text-muted">(shows a Licensed trust badge on your profile)</span>
          </label>
        </Card>

        {statusMessage && (
          <Card className="bg-merqt-indigo-soft border-merqt-indigo p-3.5 mb-5">
            <p className="text-sm text-merqt-indigo-dark">{statusMessage}</p>
          </Card>
        )}

        {/* Listings section */}
        <Card>
          <div className="flex items-center justify-between p-4 border-b border-merqt-border">
            <h2 className="font-serif text-lg font-semibold">Your listings ({products.length})</h2>
            <Button variant="primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ Add listing'}
            </Button>
          </div>

          {/* Add form */}
          {showForm && (
            <div className="p-4 border-b border-merqt-border bg-merqt-bg space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">What are you listing?</label>
                <div className="flex gap-2">
                  <button onClick={() => setType('physical')}
                    className={`flex-1 py-2 rounded text-sm font-semibold border ${type === 'physical' ? 'bg-merqt-indigo text-merqt-surface border-merqt-indigo' : 'bg-merqt-surface border-merqt-border text-merqt-text-muted'}`}>
                    A product
                  </button>
                  <button onClick={() => setType('service')}
                    className={`flex-1 py-2 rounded text-sm font-semibold border ${type === 'service' ? 'bg-merqt-indigo text-merqt-surface border-merqt-indigo' : 'bg-merqt-surface border-merqt-border text-merqt-text-muted'}`}>
                    A service
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  {type === 'physical' ? 'Product name' : 'Service name'}
                </label>
                <input className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={type === 'physical' ? 'e.g. 6-yard Ankara print' : 'e.g. Fabric styling consultation'} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Price (Naira)</label>
                <input className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
                  value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder="4500" type="number" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description (optional)</label>
                <textarea className="w-full border border-merqt-border rounded px-3 py-2 text-sm resize-none outline-none focus:border-merqt-indigo"
                  rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any details buyers should know..." />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Photos</label>
                <CldUploadWidget
                  uploadPreset="merqt_products"
                  onSuccess={(result: any) => {
                    setImages((prev) => [...prev, result.info.secure_url])
                  }}
                >
                  {({ open }) => (
                    <button
                      type="button"
                      onClick={() => open()}
                      className="w-full py-2 rounded border border-dashed border-merqt-indigo text-merqt-indigo text-sm font-semibold"
                    >
                      + Upload photo
                    </button>
                  )}
                </CldUploadWidget>
                {images.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {images.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-14 h-14 object-cover rounded border border-merqt-border" />
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} />
                Allow buyers to make offers
              </label>
              {error && <p className="text-sm text-merqt-ochre-dark">{error}</p>}
              <Button variant="primary" className="w-full" size="lg" disabled={!name || !price || saving} onClick={addProduct}>
                {saving ? 'Adding...' : 'Add to my profile'}
              </Button>
            </div>
          )}

          {/* Listings list */}
          <div className="divide-y divide-merqt-border">
            {products.length === 0 && !showForm && (
              <p className="p-6 text-center text-sm text-merqt-text-muted">
                Nothing listed yet. Click Add listing to add your first product or service.
              </p>
            )}
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{p.name}</p>
                    {p.moderation_status === 'flagged' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-merqt-ochre-soft text-merqt-ochre-dark font-semibold">
                        Under review
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-merqt-text-muted capitalize">
                    {p.type}{p.negotiable ? ' · offers allowed' : ''}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold text-merqt-indigo">{formatNaira(p.price)}</p>
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  )
}
