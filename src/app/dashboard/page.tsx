'use client'
import { CldUploadWidget } from 'next-cloudinary'
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatNaira } from '@/lib/format'
import { makeSlug } from '@/lib/slug'
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

  const [identityDraftUrl, setIdentityDraftUrl] = useState<string | null>(null)
  const [identitySubmitting, setIdentitySubmitting] = useState(false)
  const [identityError, setIdentityError] = useState('')

  const [bizName, setBizName] = useState('')
  const [bizSlug, setBizSlug] = useState('')
  const [bizSaving, setBizSaving] = useState(false)
  const [bizError, setBizError] = useState('')
  const [bizSaved, setBizSaved] = useState(false)
  const [editingBiz, setEditingBiz] = useState(false)
  const [showEditConsent, setShowEditConsent] = useState(false)

  function cooldownDaysLeft(changedAt: string | null | undefined): number {
    if (!changedAt) return 0
    const unlockAt = new Date(changedAt).getTime() + 30 * 24 * 60 * 60 * 1000
    return Math.max(0, Math.ceil((unlockAt - Date.now()) / (24 * 60 * 60 * 1000)))
  }

  const bizNameDaysLeft = cooldownDaysLeft(seller?.business_name_changed_at)
  const bizSlugDaysLeft = cooldownDaysLeft(seller?.slug_changed_at)

  async function saveBusinessProfile() {
    if (!seller) return
    setBizSaving(true)
    setBizError('')
    setBizSaved(false)
    try {
      const { error: updateErr } = await supabase
        .from('sellers')
        .update({ business_name: bizName.trim(), slug: makeSlug(bizSlug) })
        .eq('id', seller.id)

      if (updateErr) {
        if (updateErr.code === '23505') throw new Error('That business link is already taken - try another.')
        throw updateErr
      }
      await loadData()
      setBizSaved(true)
      setEditingBiz(false)
    } catch (err: any) {
      setBizError(err.message ?? 'Something went wrong')
    } finally {
      setBizSaving(false)
    }
  }

  function cancelEditBiz() {
    setBizName(seller?.business_name ?? '')
    setBizSlug(seller?.slug ?? '')
    setBizError('')
    setEditingBiz(false)
  }

  async function loadData() {
    if (!user) return

    const { data: userRow } = await supabase
      .from('users').select('id').eq('clerk_id', user.id).single()
    if (!userRow) { setLoading(false); return }

    const { data: sellerRow } = await supabase
      .from('sellers').select('*').eq('user_id', userRow.id).single()
    setSeller(sellerRow)
    if (sellerRow) {
      setBizName(sellerRow.business_name ?? '')
      setBizSlug(sellerRow.slug ?? '')
    }

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
      moderation_reason: moderationReason || null,
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

  async function submitIdentityDocument() {
    if (!identityDraftUrl) return
    setIdentitySubmitting(true)
    setIdentityError('')
    try {
      const res = await fetch('/api/agents/verification/identity-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentUrl: identityDraftUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
      setIdentityDraftUrl(null)
      loadData()
    } catch (err: any) {
      setIdentityError(err.message ?? 'Something went wrong')
    } finally {
      setIdentitySubmitting(false)
    }
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

        <div className="relative h-32 sm:h-40 rounded-card overflow-hidden mb-4 bg-merqt-indigo-soft">
          {seller.cover_photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.cover_photo_url} alt="" className="w-full h-full object-cover" />
          )}
          <CldUploadWidget
            uploadPreset="merqt_products"
            onSuccess={async (result: any) => {
              const cover_photo_url = result.info.secure_url
              setSeller((prev: any) => ({ ...prev, cover_photo_url }))
              await supabase.from('sellers').update({ cover_photo_url }).eq('id', seller.id)
            }}
          >
            {({ open }) => (
              <button
                type="button"
                onClick={() => open()}
                className="absolute bottom-2.5 right-2.5 bg-merqt-surface/90 text-merqt-text text-xs font-semibold px-2.5 py-1.5 rounded shadow-sm"
              >
                {seller.cover_photo_url ? 'Change cover photo' : '+ Add cover photo'}
              </button>
            )}
          </CldUploadWidget>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-3">
            {seller.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={seller.logo_url} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded bg-merqt-indigo-soft flex items-center justify-center text-merqt-indigo-dark font-semibold flex-shrink-0">
                {seller.business_name?.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-merqt-text-muted">Dashboard</p>
              <h1 className="font-serif text-2xl font-semibold text-merqt-text leading-tight">{seller.business_name}</h1>
              <CldUploadWidget
                uploadPreset="merqt_products"
                onSuccess={async (result: any) => {
                  const logo_url = result.info.secure_url
                  setSeller((prev: any) => ({ ...prev, logo_url }))
                  await supabase.from('sellers').update({ logo_url }).eq('id', seller.id)
                }}
              >
                {({ open }) => (
                  <button type="button" onClick={() => open()} className="text-[12.5px] font-semibold text-merqt-indigo">
                    {seller.logo_url ? 'Change logo' : '+ Add a business logo'}
                  </button>
                )}
              </CldUploadWidget>
            </div>
          </div>
          <Link href="/dashboard/orders"><Button variant="primary">Orders and requests</Button></Link>
        </div>

        <Card className="p-3.5 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Business profile</div>
            {!editingBiz && (
              <button
                type="button"
                onClick={() => setShowEditConsent(true)}
                className="text-xs font-semibold text-merqt-indigo"
              >
                Edit
              </button>
            )}
          </div>

          {!editingBiz ? (
            <div className="text-sm">
              <p className="font-semibold">{seller.business_name}</p>
              {seller.slug && <p className="text-xs text-merqt-text-muted mt-0.5">merqt.com/@{seller.slug}</p>}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1">Business name</label>
                <input
                  className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo disabled:bg-merqt-bg disabled:text-merqt-text-muted"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  disabled={bizNameDaysLeft > 0}
                />
                {bizNameDaysLeft > 0 && (
                  <p className="text-xs text-merqt-text-muted mt-1">
                    To help prevent impersonation, you can change your business name once every 30 days
                    (and not while an order is active or disputed). You can change it again in {bizNameDaysLeft} day{bizNameDaysLeft === 1 ? '' : 's'}.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Business link</label>
                <input
                  className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo disabled:bg-merqt-bg disabled:text-merqt-text-muted"
                  value={bizSlug}
                  onChange={(e) => setBizSlug(e.target.value)}
                  disabled={bizSlugDaysLeft > 0}
                />
                {bizSlug.trim() && <p className="text-xs text-merqt-text-muted mt-1">Your link: merqt.com/@{makeSlug(bizSlug)}</p>}
                {bizSlugDaysLeft > 0 && (
                  <p className="text-xs text-merqt-text-muted mt-1">
                    You can change your business link again in {bizSlugDaysLeft} day{bizSlugDaysLeft === 1 ? '' : 's'}.
                  </p>
                )}
              </div>
              {bizError && <p className="text-xs text-merqt-ochre-dark">{bizError}</p>}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" disabled={bizSaving} onClick={cancelEditBiz}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={bizSaving || !bizName.trim() || (bizName === seller.business_name && bizSlug === seller.slug)}
                  onClick={saveBusinessProfile}
                >
                  {bizSaving ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </>
          )}
          {!editingBiz && bizSaved && !bizError && <p className="text-xs text-merqt-success-dark">Saved.</p>}
        </Card>

        {showEditConsent && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setShowEditConsent(false)}
          >
            <div
              className="bg-merqt-surface border border-merqt-border rounded-card w-full max-w-sm p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-serif text-lg font-semibold text-merqt-text mb-2">Edit your business profile?</h2>
              <p className="text-sm text-merqt-text-muted mb-4 leading-relaxed">
                Your business name and link can only be changed once every 30 days, and not while you have
                an active order or an open dispute. Buyers may see a &quot;formerly known as&quot; note on your
                profile for 14 days after a change.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setShowEditConsent(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={() => { setShowEditConsent(false); setEditingBiz(true) }}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-5">
          <MetricCard value={seller.order_count} label="Orders" />
          <MetricCard value={Number(seller.rating).toFixed(1)} label="Rating" />
          <MetricCard value={products.length} label="Listings" />
          <MetricCard value={`${Math.round(seller.completion_rate)}%`} label="Completion" />
        </div>

        <div className="flex gap-4 mb-6">
          <Link href={`/@${seller.slug}`} className="text-[13.5px] font-semibold text-merqt-indigo">View Merqt profile →</Link>
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

        <Card className="p-3.5 mb-5">
          <div className="text-sm font-semibold mb-1">Identity verification</div>
          {seller.verified ? (
            <p className="text-sm text-merqt-success-dark">✓ Verified</p>
          ) : seller.identity_status === 'pending' ? (
            <p className="text-sm text-merqt-text-muted">Under review - a real person checks this, usually within a couple of days.</p>
          ) : (
            <>
              <p className="text-xs text-merqt-text-muted mb-2.5">
                Upload a government ID or business registration (CAC) document. A person reviews it before your profile shows as verified.
              </p>
              {seller.identity_status === 'rejected' && seller.identity_rejection_reason && (
                <p className="text-xs text-merqt-ochre-dark mb-2.5">{seller.identity_rejection_reason}</p>
              )}
              <CldUploadWidget
                uploadPreset="merqt_products"
                onSuccess={(result: any) => setIdentityDraftUrl(result.info.secure_url)}
              >
                {({ open }) => (
                  <button
                    type="button"
                    onClick={() => open()}
                    className="w-full py-2 rounded border border-dashed border-merqt-indigo text-merqt-indigo text-sm font-semibold mb-2"
                  >
                    {identityDraftUrl ? '✓ Document selected' : '+ Upload document'}
                  </button>
                )}
              </CldUploadWidget>
              {identityError && <p className="text-xs text-merqt-ochre-dark mb-2">{identityError}</p>}
              <Button
                variant="primary"
                className="w-full"
                disabled={!identityDraftUrl || identitySubmitting}
                onClick={submitIdentityDocument}
              >
                {identitySubmitting ? 'Submitting...' : 'Submit for verification'}
              </Button>
            </>
          )}
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
              <div key={p.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{p.name}</p>
                      {p.moderation_status === 'flagged' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-merqt-ochre-soft text-merqt-ochre-dark font-semibold">
                          Under review
                        </span>
                      )}
                      {p.moderation_status === 'rejected' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-merqt-ochre-dark text-merqt-surface font-semibold">
                          Rejected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-merqt-text-muted capitalize">
                      {p.type}{p.negotiable ? ' · offers allowed' : ''}
                    </p>
                  </div>
                  <p className="font-mono text-sm font-semibold text-merqt-indigo">{formatNaira(p.price)}</p>
                </div>
                {(p.moderation_status === 'flagged' || p.moderation_status === 'rejected') && p.moderation_reason && (
                  <p className="text-xs text-merqt-ochre-dark mt-1">{p.moderation_reason}</p>
                )}
              </div>
            ))}
          </div>
        </Card>

      </div>
    </div>
  )
}
