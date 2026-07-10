'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'
import { CATEGORIES, CITIES } from '@/lib/constants'

function makeSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
}

type PlaceResult = { placeId: string; name: string; address: string; lat: number | null; lng: number | null; types: string[] }
type PlaceMeta = { placeId: string; lat: number | null; lng: number | null; hours: string[] | null }

export default function OnboardingPage() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')
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

  async function handleSubmit() {
    if (!user) return
    setLoading(true)
    setError('')

    try {
      // Step 1: make sure this user exists in our database
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('clerk_id', user.id)
        .single()

      let userId = existingUser?.id

      if (!userId) {
        const { data: newUser, error: userErr } = await supabase
          .from('users')
          .insert({
            clerk_id: user.id,
            email: user.primaryEmailAddress?.emailAddress ?? '',
            name: user.fullName ?? '',
            avatar_url: user.imageUrl ?? '',
            role: 'seller',
          })
          .select('id')
          .single()
        if (userErr) throw userErr
        userId = newUser.id
      }

      // Step 2: create the seller profile
      const { error: sellerErr } = await supabase.from('sellers').insert({
        user_id: userId,
        business_name: businessName,
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
    <div className="min-h-screen bg-li-page flex items-start justify-center pt-10 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-li-text-1 mb-1">Set up your Merqt profile</h1>
          <p className="text-li-text-2 text-sm">Your trade profile on Merqt. Takes 2 minutes.</p>
        </div>

        <div className="bg-white border border-li-border rounded-card p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Business name</label>
            <input
              className="w-full border border-li-border rounded px-3 py-2 text-sm focus:outline-none focus:border-li-blue"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Zara Fabrics Lagos"
            />
            {businessName.length >= 3 && (
              <p className="text-xs text-li-text-3 mt-1">
                Your link: merqt.com/@{makeSlug(businessName)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Category</label>
            <select
              className="w-full border border-li-border rounded px-3 py-2 text-sm focus:outline-none focus:border-li-blue"
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
              className="w-full border border-li-border rounded px-3 py-2 text-sm focus:outline-none focus:border-li-blue"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">Select your city</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-li-border pt-4">
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
            <div className="border-t border-li-border pt-4">
              <label className="block text-sm font-semibold mb-1">
                Find your business on Google Maps <span className="font-normal text-li-text-3">(optional)</span>
              </label>
              <p className="text-xs text-li-text-3 mb-2">
                Can&apos;t find your business? No problem - just fill in the address below yourself.
              </p>
              <button
                type="button"
                onClick={searchPlaces}
                disabled={businessName.length < 3 || city === '' || searching}
                className={`w-full py-2 rounded-pill border-2 font-semibold text-sm ${
                  businessName.length >= 3 && city !== '' && !searching
                    ? 'border-li-blue text-li-blue'
                    : 'border-li-border text-li-text-3 cursor-not-allowed'
                }`}
              >
                {searching ? 'Searching...' : 'Search Google Maps'}
              </button>

              {searched && placeResults.length === 0 && !placeMeta && (
                <p className="text-xs text-li-text-3 mt-2">No matching listing found - no problem, just continue below.</p>
              )}

              {placeResults.length > 0 && !selectedPlace && (
                <div className="mt-2 space-y-2">
                  {placeResults.map((p) => (
                    <button
                      key={p.placeId}
                      type="button"
                      onClick={() => setSelectedPlace(p)}
                      className="w-full text-left border border-li-border rounded p-2 text-sm hover:border-li-blue"
                    >
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-li-text-2">{p.address}</p>
                    </button>
                  ))}
                </div>
              )}

              {selectedPlace && (
                <div className="mt-2 border border-li-border rounded p-3 space-y-2">
                  <p className="text-sm font-semibold">Is this your business?</p>
                  <p className="text-sm">{selectedPlace.name}</p>
                  <p className="text-xs text-li-text-2">{selectedPlace.address}</p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPlace(null)}
                      disabled={verifying}
                      className="flex-1 py-1.5 rounded-pill border border-li-border text-li-text-2 font-semibold text-xs"
                    >
                      Choose a different one
                    </button>
                    <button
                      type="button"
                      onClick={confirmSelectedPlace}
                      disabled={verifying}
                      className="flex-1 py-1.5 rounded-pill bg-li-blue text-white font-semibold text-xs"
                    >
                      {verifying ? 'Checking...' : 'Yes, this is correct'}
                    </button>
                  </div>
                </div>
              )}

              {placeMeta && verification && (
                <div className="mt-2 border border-li-blue rounded p-3 space-y-1">
                  <p className={`text-xs ${verification.categoryMatch ? 'text-li-text-2' : 'text-li-red'}`}>
                    {verification.reasoning}
                  </p>
                  {placeMeta.hours && (
                    <p className="text-xs text-li-text-2">{placeMeta.hours.join(' · ')}</p>
                  )}
                  <p className="text-xs text-li-text-3">Address and phone below have been filled in - you can still edit them.</p>
                  <button
                    type="button"
                    onClick={() => { setPlaceMeta(null); setVerification(null); setSearched(false) }}
                    className="text-xs text-li-blue font-semibold"
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
                Address <span className="font-normal text-li-text-3">(optional)</span>
              </label>
              <input
                className="w-full border border-li-border rounded px-3 py-2 text-sm focus:outline-none focus:border-li-blue"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12 Adeola Odeku St, Victoria Island"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-1">
              Phone <span className="font-normal text-li-text-3">(optional)</span>
            </label>
            <input
              className="w-full border border-li-border rounded px-3 py-2 text-sm focus:outline-none focus:border-li-blue"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Bio <span className="font-normal text-li-text-3">(optional)</span>
            </label>
            <textarea
              className="w-full border border-li-border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-li-blue"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell buyers what you sell..."
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              WhatsApp <span className="font-normal text-li-text-3">(optional)</span>
            </label>
            <input
              className="w-full border border-li-border rounded px-3 py-2 text-sm focus:outline-none focus:border-li-blue"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+234 800 000 0000"
            />
          </div>

          {error && <p className="text-sm text-li-red">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className={`w-full py-2.5 rounded-pill font-semibold text-sm text-white ${
              canSubmit && !loading ? 'bg-li-blue hover:bg-li-blue-dark' : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {loading ? 'Creating your profile...' : 'Launch my Merqt profile'}
          </button>
        </div>
      </div>
    </div>
  )
}