'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CldUploadWidget } from 'next-cloudinary'
import { useUser } from '@clerk/nextjs'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ensureUserRow } from '@/lib/ensureUser'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { PostSocialBar } from '@/components/shared/PostSocialBar'

function timeAgoShort(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function SellerThumb({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return <Avatar src={logoUrl} name={name} size={44} shape="square" />
}

export default function NetworkPage() {
  const { user, isSignedIn } = useUser()
  const supabase = useSupabaseClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [ownUserId, setOwnUserId] = useState<string | null>(null)
  const [ownSellerId, setOwnSellerId] = useState<string | null>(null)
  const [following, setFollowing] = useState<any[]>([])
  const [followingPeople, setFollowingPeople] = useState<any[]>([])
  const [recommended, setRecommended] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [followedSellerIds, setFollowedSellerIds] = useState<Set<string>>(new Set())
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set())
  const [networkSellerIds, setNetworkSellerIds] = useState<Set<string>>(new Set())
  const [networkAuthorIds, setNetworkAuthorIds] = useState<Set<string>>(new Set())

  const [draftText, setDraftText] = useState('')
  const [draftImage, setDraftImage] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)

  async function loadFeed() {
    const { data: postRows } = await supabase
      .from('posts')
      .select('*, author:users(name, avatar_url, slug), seller:sellers(business_name, slug, logo_url)')
      .order('created_at', { ascending: false })
      .limit(150)
    setPosts(postRows ?? [])
  }

  async function loadPersonal() {
    if (!user) { setLoading(false); return }

    const { data: userRow } = await supabase.from('users').select('id').eq('clerk_id', user.id).single()
    if (!userRow) { setLoading(false); return }
    setOwnUserId(userRow.id)

    const { data: sellerRow } = await supabase.from('sellers').select('id').eq('user_id', userRow.id).single()
    setOwnSellerId(sellerRow?.id ?? null)

    const { data: followRows } = await supabase
      .from('follows')
      .select('seller_id, followee_user_id, sellers(id, business_name, slug, category, city, logo_url), followee:users!followee_user_id(id, name, slug, avatar_url)')
      .eq('follower_id', userRow.id)
    const followedSellers = (followRows ?? []).map((f: any) => f.sellers).filter(Boolean)
    const followedPeople = (followRows ?? []).map((f: any) => f.followee).filter(Boolean)
    setFollowing(followedSellers)
    setFollowingPeople(followedPeople)
    setFollowedSellerIds(new Set(followedSellers.map((s: any) => s.id)))
    setFollowedUserIds(new Set(followedPeople.map((u: any) => u.id)))

    // Who follows me back (as a person, and as my business if I have one)
    let followerUserIds: string[] = []
    const { data: followerOfMeRows } = await supabase.from('follows').select('follower_id').eq('followee_user_id', userRow.id)
    followerUserIds = (followerOfMeRows ?? []).map((r: any) => r.follower_id)
    if (sellerRow) {
      const { data: followerOfBizRows } = await supabase.from('follows').select('follower_id').eq('seller_id', sellerRow.id)
      followerUserIds = [...followerUserIds, ...(followerOfBizRows ?? []).map((r: any) => r.follower_id)]
    }
    followerUserIds = Array.from(new Set(followerUserIds))

    const relevantUserIds = Array.from(new Set([...followedPeople.map((u: any) => u.id), ...followerUserIds]))
    let relevantSellerIds = followedSellers.map((s: any) => s.id)
    if (relevantUserIds.length > 0) {
      const { data: theirSellers } = await supabase.from('sellers').select('id, user_id').in('user_id', relevantUserIds)
      relevantSellerIds = Array.from(new Set([...relevantSellerIds, ...(theirSellers ?? []).map((s: any) => s.id)]))
    }
    setNetworkSellerIds(new Set(relevantSellerIds))
    setNetworkAuthorIds(new Set(relevantUserIds))

    const excludeIds = [...followedSellers.map((s: any) => s.id), sellerRow?.id].filter(Boolean)
    const { data: recRows } = await supabase
      .from('sellers')
      .select('id, business_name, slug, category, city, logo_url')
      .order('rating', { ascending: false })
      .limit(20)
    setRecommended((recRows ?? []).filter((s) => !excludeIds.includes(s.id)).slice(0, 5))

    setLoading(false)
  }

  useEffect(() => {
    loadFeed()
    loadPersonal()
  }, [user])

  const networkPosts = posts.filter((post) =>
    (post.seller_id && networkSellerIds.has(post.seller_id)) ||
    (post.author_user_id && networkAuthorIds.has(post.author_user_id))
  )

  async function toggleFollow(sellerId: string) {
    if (!user) { router.push('/login'); return }
    const userId = await ensureUserRow(supabase, user)
    if (followedSellerIds.has(sellerId)) {
      await supabase.from('follows').delete().eq('follower_id', userId).eq('seller_id', sellerId)
    } else {
      await supabase.from('follows').insert({ follower_id: userId, seller_id: sellerId })
    }
    loadPersonal()
  }

  async function toggleFollowUser(followeeUserId: string) {
    if (!user) { router.push('/login'); return }
    const userId = await ensureUserRow(supabase, user)
    if (followedUserIds.has(followeeUserId)) {
      await supabase.from('follows').delete().eq('follower_id', userId).eq('followee_user_id', followeeUserId)
    } else {
      await supabase.from('follows').insert({ follower_id: userId, followee_user_id: followeeUserId })
    }
    loadPersonal()
  }

  async function submitPost() {
    if (!user || draftText.trim().length === 0) return
    setPosting(true)
    try {
      const userId = await ensureUserRow(supabase, user)
      await supabase.from('posts').insert({
        author_user_id: userId,
        seller_id: ownSellerId,
        text: draftText.trim(),
        image_url: draftImage,
      })
      setDraftText('')
      setDraftImage(null)
      loadFeed()
    } finally {
      setPosting(false)
    }
  }

  if (loading) return <div className="p-10 text-merqt-text-muted">Loading...</div>

  return (
    <div className="min-h-screen bg-merqt-bg py-7 px-5">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-5">

        {/* Following */}
        <div>
          <h3 className="font-serif text-base font-semibold text-merqt-text mb-3">Following</h3>
          {!isSignedIn ? (
            <p className="text-xs text-merqt-text-muted leading-relaxed">Sign in to follow businesses and people, and see their updates here.</p>
          ) : following.length === 0 && followingPeople.length === 0 ? (
            <p className="text-xs text-merqt-text-muted leading-relaxed">Follow a business or a person from their profile to see their updates here.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {following.map((s) => (
                <Card key={s.id} className="p-3">
                  <Link href={`/@${s.slug}`} className="flex gap-2.5 items-center mb-2">
                    <SellerThumb name={s.business_name} logoUrl={s.logo_url} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold truncate">{s.business_name}</div>
                      <div className="text-[11.5px] text-merqt-text-muted truncate">{s.category} · {s.city}</div>
                    </div>
                  </Link>
                  <div className="flex gap-2">
                    <a href={`/@${s.slug}/marketplace`} className="flex-1">
                      <button className="w-full bg-merqt-indigo text-merqt-surface rounded px-2.5 py-1.5 text-[11.5px] font-semibold">
                        Marketplace
                      </button>
                    </a>
                    <button
                      onClick={() => toggleFollow(s.id)}
                      className="bg-merqt-bg border border-merqt-border text-merqt-text-muted rounded px-2.5 py-1.5 text-[11.5px] font-semibold"
                    >
                      Unfollow
                    </button>
                  </div>
                </Card>
              ))}
              {followingPeople.map((u) => (
                <Card key={u.id} className="p-3">
                  <Link href={`/u/${u.slug}`} className="flex gap-2.5 items-center mb-2">
                    <Avatar src={u.avatar_url} name={u.name} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold truncate">{u.name}</div>
                    </div>
                  </Link>
                  <button
                    onClick={() => toggleFollowUser(u.id)}
                    className="w-full bg-merqt-bg border border-merqt-border text-merqt-text-muted rounded px-2.5 py-1.5 text-[11.5px] font-semibold"
                  >
                    Unfollow
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Feed */}
        <div>
          <h1 className="font-serif text-2xl font-semibold text-merqt-text mb-5">Your network</h1>

          {isSignedIn && (
            <Card className="p-4 mb-4">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={ownSellerId ? "New stock, a completed job, a customer shoutout..." : "What are you looking for, or a shoutout about a good experience..."}
                className="w-full min-h-[64px] border border-merqt-border rounded px-3 py-2.5 text-sm outline-none focus:border-merqt-indigo resize-none mb-2.5"
              />
              <div className="flex items-center gap-2.5">
                <CldUploadWidget
                  uploadPreset="merqt_products"
                  onSuccess={(result: any) => setDraftImage(result.info.secure_url)}
                >
                  {({ open }) => (
                    <button
                      type="button"
                      onClick={() => open()}
                      className="border border-dashed border-merqt-border text-merqt-text-muted rounded px-2.5 py-1.5 text-xs font-semibold"
                    >
                      {draftImage ? '✓ Photo added' : '+ Photo'}
                    </button>
                  )}
                </CldUploadWidget>
                <div className="flex-1" />
                <Button variant="primary" disabled={posting || draftText.trim().length === 0} onClick={submitPost}>
                  {posting ? 'Posting...' : 'Post'}
                </Button>
              </div>
            </Card>
          )}

          <div className="flex flex-col gap-3.5">
            {networkPosts.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-sm text-merqt-text-muted">
                  {isSignedIn
                    ? 'Nothing here yet. Follow businesses or people (or wait for them to follow you) to see their updates in your network.'
                    : 'Sign in and follow businesses or people to see their updates here.'}
                </p>
              </Card>
            )}
            {networkPosts.map((post) => {
              const isSeller = !!post.seller_id
              const authorName = isSeller ? post.seller?.business_name : post.author?.name || 'Buyer'
              const profileHref = isSeller
                ? post.seller?.slug ? `/@${post.seller.slug}` : null
                : post.author?.slug ? `/u/${post.author.slug}` : null
              const authorAvatar = (
                <Avatar
                  src={isSeller ? post.seller?.logo_url : post.author?.avatar_url}
                  name={authorName}
                  size={36}
                  shape={isSeller ? 'square' : 'circle'}
                />
              )
              return (
                <Card key={post.id} className="p-4">
                  <div className="flex justify-between items-start mb-2.5">
                    {profileHref ? (
                      <Link href={profileHref} className="flex items-center gap-2.5">
                        {authorAvatar}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{authorName}</span>
                            {isSeller && (
                              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-merqt-indigo-soft text-merqt-indigo-dark">
                                Business
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-merqt-text-muted">{timeAgoShort(post.created_at)}</div>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        {authorAvatar}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{authorName}</span>
                            {isSeller && (
                              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-merqt-indigo-soft text-merqt-indigo-dark">
                                Business
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-merqt-text-muted">{timeAgoShort(post.created_at)}</div>
                        </div>
                      </div>
                    )}
                    {isSeller && post.seller_id && post.seller_id !== ownSellerId && (
                      <button
                        onClick={() => toggleFollow(post.seller_id)}
                        className={`rounded px-2.5 py-1 text-[11.5px] font-semibold ${followedSellerIds.has(post.seller_id) ? 'border border-merqt-border text-merqt-text-muted' : 'bg-merqt-indigo text-merqt-surface'}`}
                      >
                        {followedSellerIds.has(post.seller_id) ? 'Following' : 'Follow'}
                      </button>
                    )}
                    {!isSeller && post.author_user_id && post.author_user_id !== ownUserId && (
                      <button
                        onClick={() => toggleFollowUser(post.author_user_id)}
                        className={`rounded px-2.5 py-1 text-[11.5px] font-semibold ${followedUserIds.has(post.author_user_id) ? 'border border-merqt-border text-merqt-text-muted' : 'bg-merqt-indigo text-merqt-surface'}`}
                      >
                        {followedUserIds.has(post.author_user_id) ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed mb-2.5">{post.text}</p>
                  {post.image_url && (
                    <img src={post.image_url} alt="" className="w-full rounded object-cover max-h-96" />
                  )}
                  <PostSocialBar postId={post.id} />
                </Card>
              )
            })}
          </div>
        </div>

        {/* Recommended */}
        <div>
          <h3 className="font-serif text-base font-semibold text-merqt-text mb-3">Recommended</h3>
          <div className="flex flex-col gap-2.5">
            {recommended.map((s) => (
              <Card key={s.id} className="p-3">
                <a href={`/@${s.slug}`} className="flex gap-2.5 items-center mb-2">
                  <SellerThumb name={s.business_name} logoUrl={s.logo_url} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold truncate">{s.business_name}</div>
                    <div className="text-[11.5px] text-merqt-text-muted truncate">{s.category} · {s.city}</div>
                  </div>
                </a>
                <button
                  onClick={() => toggleFollow(s.id)}
                  className="w-full bg-transparent border border-merqt-indigo text-merqt-indigo rounded px-2.5 py-1.5 text-[11.5px] font-semibold"
                >
                  Follow
                </button>
              </Card>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
