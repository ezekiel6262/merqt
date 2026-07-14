'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { CldUploadWidget } from 'next-cloudinary'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ensureUserRow } from '@/lib/ensureUser'
import { makeSlug } from '@/lib/slug'
import { getInitials } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function ProfileSettingsPage() {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [slug, setSlug] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      if (!user) return
      const id = await ensureUserRow(supabase, user)
      const { data } = await supabase.from('users').select('*').eq('id', id).single()
      setUserId(id)
      setName(data?.name ?? '')
      setBio(data?.bio ?? '')
      setSlug(data?.slug ?? '')
      setAvatarUrl(data?.avatar_url ?? '')
      setCoverPhotoUrl(data?.cover_photo_url ?? '')
      setLoaded(true)
    }
    load()
  }, [user])

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const { error: updateErr } = await supabase
        .from('users')
        .update({
          name: name.trim(),
          bio: bio.trim() || null,
          slug: slug.trim() ? makeSlug(slug) : null,
          avatar_url: avatarUrl || null,
          cover_photo_url: coverPhotoUrl || null,
        })
        .eq('id', userId)

      if (updateErr) {
        if (updateErr.code === '23505') throw new Error('That profile link is already taken - try another.')
        throw updateErr
      }
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) {
    return <div className="min-h-screen bg-merqt-bg" />
  }

  return (
    <div className="min-h-screen bg-merqt-bg py-8 px-5">
      <div className="max-w-lg mx-auto">
        <h1 className="font-serif text-2xl font-semibold text-merqt-text mb-1">Your profile</h1>
        <p className="text-sm text-merqt-text-muted mb-6">This is your personal Merqt profile, separate from any business profile.</p>

        <Card className="p-5 space-y-4">
          <div className="relative h-28 sm:h-36 -m-5 mb-0 rounded-t-card overflow-hidden bg-merqt-indigo-soft">
            {coverPhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPhotoUrl} alt="" className="w-full h-full object-cover" />
            )}
            <CldUploadWidget uploadPreset="merqt_products" onSuccess={(result: any) => setCoverPhotoUrl(result.info.secure_url)}>
              {({ open }) => (
                <button
                  type="button"
                  onClick={() => open()}
                  className="absolute bottom-2.5 right-2.5 bg-merqt-surface/90 text-merqt-text text-xs font-semibold px-2.5 py-1.5 rounded shadow-sm"
                >
                  {coverPhotoUrl ? 'Change cover photo' : '+ Add cover photo'}
                </button>
              )}
            </CldUploadWidget>
          </div>

          <div className="flex items-center gap-4 pt-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={name} className="w-16 h-16 rounded-card object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-card bg-merqt-indigo-soft flex items-center justify-center text-merqt-indigo-dark text-xl font-semibold flex-shrink-0">
                {getInitials(name || 'M')}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <CldUploadWidget uploadPreset="merqt_products" onSuccess={(result: any) => setAvatarUrl(result.info.secure_url)}>
                {({ open }) => (
                  <button type="button" onClick={() => open()} className="text-[13px] font-semibold text-merqt-indigo text-left">
                    Upload a photo
                  </button>
                )}
              </CldUploadWidget>
              {user?.imageUrl && avatarUrl !== user.imageUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(user.imageUrl)}
                  className="text-[13px] font-semibold text-merqt-text-muted text-left"
                >
                  Use my Google photo instead
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Name</label>
            <input
              className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Profile link <span className="font-normal text-merqt-text-muted">(optional)</span>
            </label>
            <input
              className="w-full border border-merqt-border rounded px-3 py-2 text-sm outline-none focus:border-merqt-indigo"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. zek"
            />
            {slug.trim() && (
              <p className="text-xs text-merqt-text-muted mt-1">Your link: merqt.com/u/{makeSlug(slug)}</p>
            )}
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
              placeholder="A little about you..."
            />
          </div>

          {error && <p className="text-sm text-merqt-ochre-dark">{error}</p>}
          {saved && !error && <p className="text-sm text-merqt-success-dark">Saved.</p>}

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => router.back()}>Back</Button>
            <Button variant="primary" className="flex-1" disabled={saving || !name.trim()} onClick={handleSave}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </Card>

        <Link href="/settings/account" className="block mt-4 text-[13px] font-semibold text-merqt-indigo">
          Manage email, password &amp; account security →
        </Link>
      </div>
    </div>
  )
}
