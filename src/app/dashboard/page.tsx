'use client'
import { CldUploadWidget } from 'next-cloudinary'
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'
import Link from 'next/link'

function formatNGN(amount: number) {
  return 'N' + amount.toLocaleString('en-NG')
}

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

    const { error } = await supabase.from('products').insert({
      seller_id: seller.id,
      name,
      price: parseFloat(price),
      description: description || null,
      type,
      negotiable,
      images,
    })

    if (!error) {
      setName(''); setPrice(''); setDescription(''); setType('physical'); setNegotiable(false); setImages([])
      setShowForm(false)
      loadData()
    }
    setSaving(false)
  }

  if (loading) return <div className="p-10 text-li-text-2">Loading...</div>
  if (!seller) return (
    <div className="p-10">
      <p className="text-li-text-2">No profile found. <Link href="/onboarding" className="text-li-blue">Set one up</Link>.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-li-page py-4 px-4">
      <div className="max-w-2xl mx-auto space-y-2">

        {/* Header */}
        <div className="bg-white border border-li-border rounded-card p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold">Welcome back</h1>
            <p className="text-sm text-li-text-2">{seller.business_name}</p>
          </div>
          <Link href="/dashboard/orders"
                className="px-4 py-1.5 rounded-pill bg-li-blue text-white font-semibold text-sm ml-2">
            Orders and requests
          </Link>
        </div>

        {/* Profile link banner */}
        <div className="bg-li-blue-bg border border-li-blue rounded-card p-3">
          <p className="text-sm text-li-blue">
            Your public link: <span className="font-semibold">merqt.com/@{seller.slug}</span>
          </p>
        </div>

        {/* Listings section */}
        <div className="bg-white border border-li-border rounded-card">
          <div className="flex items-center justify-between p-4 border-b border-li-border">
            <h2 className="font-semibold">Your listings ({products.length})</h2>
            <button onClick={() => setShowForm(!showForm)}
                    className="px-4 py-1.5 rounded-pill bg-li-blue text-white font-semibold text-sm">
              {showForm ? 'Cancel' : '+ Add listing'}
            </button>
          </div>

          {/* Add form */}
          {showForm && (
            <div className="p-4 border-b border-li-border bg-li-page space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">What are you listing?</label>
                <div className="flex gap-2">
                  <button onClick={() => setType('physical')}
                    className={`flex-1 py-2 rounded text-sm font-semibold border ${type === 'physical' ? 'bg-li-blue text-white border-li-blue' : 'bg-white border-li-border text-li-text-2'}`}>
                    A product
                  </button>
                  <button onClick={() => setType('service')}
                    className={`flex-1 py-2 rounded text-sm font-semibold border ${type === 'service' ? 'bg-li-blue text-white border-li-blue' : 'bg-white border-li-border text-li-text-2'}`}>
                    A service
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">
                  {type === 'physical' ? 'Product name' : 'Service name'}
                </label>
                <input className="w-full border border-li-border rounded px-3 py-2 text-sm"
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={type === 'physical' ? 'e.g. 6-yard Ankara print' : 'e.g. Fabric styling consultation'} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Price (Naira)</label>
                <input className="w-full border border-li-border rounded px-3 py-2 text-sm"
                  value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder="4500" type="number" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description (optional)</label>
                <textarea className="w-full border border-li-border rounded px-3 py-2 text-sm resize-none"
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
                      className="w-full py-2 rounded border border-dashed border-li-blue text-li-blue text-sm font-semibold"
                    >
                      + Upload photo
                    </button>
                  )}
                </CldUploadWidget>
                {images.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {images.map((url, i) => (
                      <img key={i} src={url} alt="" className="w-14 h-14 object-cover rounded border border-li-border" />
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} />
                Allow buyers to make offers
              </label>
              <button onClick={addProduct} disabled={!name || !price || saving}
                className={`w-full py-2 rounded-pill font-semibold text-sm text-white ${name && price && !saving ? 'bg-li-blue' : 'bg-gray-300'}`}>
                {saving ? 'Adding...' : 'Add to my profile'}
              </button>
            </div>
          )}

          {/* Listings list */}
          <div className="divide-y divide-li-border">
            {products.length === 0 && !showForm && (
              <p className="p-6 text-center text-sm text-li-text-2">
                Nothing listed yet. Click Add listing to add your first product or service.
              </p>
            )}
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-li-text-2 capitalize">
                    {p.type}{p.negotiable ? ' · offers allowed' : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold text-li-blue">{formatNGN(p.price)}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}