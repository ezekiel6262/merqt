'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { CldUploadWidget } from 'next-cloudinary'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ensureUserRow } from '@/lib/ensureUser'
import { makeSlug } from '@/lib/slug'
import { getInitials } from '@/lib/format'
import { CATEGORIES, CITIES } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type PlaceResult = { placeId: string; name: string; address: string; lat: number | null; lng: number | null; types: string[] }
type PlaceMeta = { placeId: string; lat: number | null; lng: number | null; hours: string[] | null }

export default function OnboardingPage() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [noPhysicalOffice, setNoPhysicalOffice] = useState(false)
  const [bio, setBio] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [searching, setSearching] = useState(false)
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([])
  const [searched, setSearched] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [placeMeta, setPlaceMeta] = useState<PlaceMeta | null>(null)
  const [verification, setVerification] = useState<{ categoryMatch: boolean; matchedCategory: string; reasoning: string } | null>(null)

  async function searchPlaces() {
    setSearching(true)
    setSearched(false)
    setSelectedPlace(null)
    setPlaceMeta(null)
    setVerification(null)
    try {
      const res = await fetch('/api/agents/onboarding/search-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, city }),
      })
      const data = await res.json()
      setPlaceResults(data.results ?? [])
    } catch {
      setPlaceResults([])
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }

  async function confirmSelectedPlace() {
    if (!selectedPlace) return
    setVerifying(true)
    try {
      const res = await fetch('/api/agents/onboarding/verify-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: selectedPlace.placeId, businessName, category, city }),
      })
      const data = await res.json()
      if (data.place) {
        setAddress(data.place.address ?? '')
        setPhone(data.place.phone ?? '')
        setPlaceMeta({ placeId: data.place.placeId, lat: data.place.lat, lng: data.place.lng, hours: data.place.hours })
        setVerification(data.verification)
        setPlaceResults([])
        setSelectedPlace(null)
      }
    } finally {
      setVerifying(false)
    }
  }

  async function handleSkip() {
    if (user) {
      try {
        await ensureUserRow(supabase, user)
      } catch {
        // if this fails, the user row still gets created lazily on the next page they visit
      }
    }
    router.push('/discover')
  }

  async function handleSubmit() {
    if (!user) return
    setLoading(true)
    setError('')

    try {
      const userId = await ensureUserRow(supabase, user)

      const { error: sellerErr } = await supabase.from('sellers').insert({
        user_id: userId,
        business_name: businessName,
        logo_url: logoUrl || null,
        slug: makeSlug(businessName),
        bio: bio || null,
        category,
        city,
        whatsapp: whatsapp || null,
        address: noPhysicalOffice ? null : address || null,
        phone: phone || null,
        ...(placeMeta && {
          latitude: placeMeta.lat,
          longitude: placeMeta.lng,
          google_place_id: placeMeta.placeId,
          hours: placeMeta.hours,
        }),
      })
      if (sellerErr) throw sellerErr

      await supabase.from('users').update({ role: 'seller' }).eq('id', userId)

      router.push('/dashboard')
    } catch (err) {
      console.error('Onboarding error:', err)
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = businessName.length >= 3 && category !== '' && city !== ''

  return (
    <div className="min-h-screen bg-merqt-bg flex items-start justify-center pt-12 px-4 pb-12">
      <div className="w-full max-w-lg">
        <div className="flex justify-end mb-2">
          <button type="button" onClick={handleSkip} className="text-[13px] font-semibold text-merqt-text-muted hover:text-merqt-text">
            Skip for now →
          </button>
        </div>
        <div className="text-center mb-7">
          <h1 className="font-serif text-2xl font-semibold text-merqt-text mb-1.5">Set up your Merqt profile</h1>
          <p className="text-merqt-text-muted text-sm">Your trade profile on Merqt. Takes 2 minutes. Not selling yet? You can skip this and browse as a buyer.</p>
        </div>

        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-3.5">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded bg-merqt-indigo-soft flex items-center justify-center text-merqt-indigo-dark font-semibold flex-shrink-0">
                {getInitials(businessName || 'M')}
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold mb-1">
                Business logo <span className="font-normal text-merqt-text-muted">(optional)</span>
              </label>
              <CldUploadWidget uploadPreset="merqt_products" onSuccess={(result: any) => setLogoUrl(result.info.secure_url)}>
                {({ open }) => (
                  <button type="button" onClick={() => open()} className="text-[13px] font-semibold text-merqt-indigo">
                    {logoUrl ? 'Change photo' : '+ Upload a photo'}
                  </button>
                )}
              </CldUploadWidget>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Business name</label>
            <input
              className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Zara Fabrics Lagos"
            />
            {businessName.length >= 3 && (
              <p className="text-xs text-merqt-text-muted mt-1">
                Your link: merqt.com/@{makeSlug(businessName)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Category</label>
            <select
              className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">City</label>
            <select
              className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">Select your city</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-merqt-border pt-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={noPhysicalOffice}
                onChange={(e) => {
                  setNoPhysicalOffice(e.target.checked)
                  if (e.target.checked) {
                    setAddress('')
                    setPlaceMeta(null)
                    setVerification(null)
                    setPlaceResults([])
                    setSelectedPlace(null)
                  }
                }}
              />
              I have no physical office (I work remotely / from home)
            </label>
          </div>

          {!noPhysicalOffice && (
            <div className="border-t border-merqt-border pt-4">
              <label className="block text-sm font-semibold mb-1">
                Find your business on Google Maps <span className="font-normal text-merqt-text-muted">(optional)</span>
              </label>
              <p className="text-xs text-merqt-text-muted mb-2">
                Can&apos;t find your business? No problem - just fill in the address below yourself.
              </p>
              <button
                type="button"
                onClick={searchPlaces}
                disabled={businessName.length < 3 || city === '' || searching}
                className={`w-full py-2 rounded border-2 font-semibold text-sm ${
                  businessName.length >= 3 && city !== '' && !searching
                    ? 'border-merqt-indigo text-merqt-indigo'
                    : 'border-merqt-border text-merqt-text-muted cursor-not-allowed'
                }`}
              >
                {searching ? 'Searching...' : 'Search Google Maps'}
              </button>

              {searched && placeResults.length === 0 && !placeMeta && (
                <p className="text-xs text-merqt-text-muted mt-2">No matching listing found - no problem, just continue below.</p>
              )}

              {placeResults.length > 0 && !selectedPlace && (
                <div className="mt-2 space-y-2">
                  {placeResults.map((p) => (
                    <button
                      key={p.placeId}
                      type="button"
                      onClick={() => setSelectedPlace(p)}
                      className="w-full text-left border border-merqt-border rounded p-2 text-sm hover:border-merqt-indigo"
                    >
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-merqt-text-muted">{p.address}</p>
                    </button>
                  ))}
                </div>
              )}

              {selectedPlace && (
                <div className="mt-2 border border-merqt-border rounded p-3 space-y-2">
                  <p className="text-sm font-semibold">Is this your business?</p>
                  <p className="text-sm">{selectedPlace.name}</p>
                  <p className="text-xs text-merqt-text-muted">{selectedPlace.address}</p>
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" size="sm" className="flex-1" disabled={verifying} onClick={() => setSelectedPlace(null)}>
                      Choose a different one
                    </Button>
                    <Button variant="primary" size="sm" className="flex-1" disabled={verifying} onClick={confirmSelectedPlace}>
                      {verifying ? 'Checking...' : 'Yes, this is correct'}
                    </Button>
                  </div>
                </div>
              )}

              {placeMeta && verification && (
                <div className="mt-2 border border-merqt-indigo rounded p-3 space-y-1">
                  <p className={`text-xs ${verification.categoryMatch ? 'text-merqt-text-muted' : 'text-merqt-ochre-dark'}`}>
                    {verification.reasoning}
                  </p>
                  {placeMeta.hours && (
                    <p className="text-xs text-merqt-text-muted">{placeMeta.hours.join(' · ')}</p>
                  )}
                  <p className="text-xs text-merqt-text-muted">Address and phone below have been filled in - you can still edit them.</p>
                  <button
                    type="button"
                    onClick={() => { setPlaceMeta(null); setVerification(null); setSearched(false) }}
                    className="text-xs text-merqt-indigo font-semibold"
                  >
                    Search again
                  </button>
                </div>
              )}
            </div>
          )}

          {!noPhysicalOffice && (
            <div>
              <label className="block text-sm font-semibold mb-1">
                Address <span className="font-normal text-merqt-text-muted">(optional)</span>
              </label>
              <input
                className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12 Adeola Odeku St, Victoria Island"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-1">
              Phone <span className="font-normal text-merqt-text-muted">(optional)</span>
            </label>
            <input
              className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Bio <span className="font-normal text-merqt-text-muted">(optional)</span>
            </label>
            <textarea
              className="w-full border border-merqt-border rounded px-3 py-2 text-sm resize-none outline-none focus:border-merqt-indigo"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell buyers what you sell..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              WhatsApp <span className="font-normal text-merqt-text-muted">(optional)</span>
            </label>
            <input
              className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </div>

          {error && <p className="text-sm text-merqt-ochre-dark">{error}</p>}

          <Button variant="primary" size="lg" className="w-full" disabled={!canSubmit || loading} onClick={handleSubmit}>
            {loading ? 'Creating your profile...' : 'Launch my Merqt profile'}
          </Button>
        </Card>
      </div>
    </div>
  )
}
