'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser, useSession } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'

const CATEGORIES = [
  'Fashion and Textiles',
  'Food and Catering',
  'Electronics and Gadgets',
  'Home Services',
  'Beauty and Wellness',
  'Creative Services',
  'Professional Services',
  'Other',
]

const CITIES = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu', 'Benin City']

function makeSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
}

export default function OnboardingPage() {
  const { user } = useUser()
  const { session } = useSession()
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!user) return
    setLoading(true)
    setError('')

    try {
      const debugToken = await session?.getToken()
      if (debugToken) {
        const payload = JSON.parse(atob(debugToken.split('.')[1]))
        console.log('DEBUG Clerk JWT payload:', payload)
      } else {
        console.log('DEBUG: no Clerk session token available')
      }

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