'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@/lib/supabase/client'
import { ensureUserRow } from '@/lib/ensureUser'
import { Avatar } from '@/components/ui/Avatar'

export function PostSocialBar({
  postId,
  shareUrl = '/network',
  onReposted,
}: {
  postId: string
  shareUrl?: string
  onReposted?: () => void
}) {
  const { user } = useUser()
  const supabase = useSupabaseClient()
  const router = useRouter()

  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [repostCount, setRepostCount] = useState(0)
  const [reposted, setReposted] = useState(false)
  const [reposting, setReposting] = useState(false)
  const [copied, setCopied] = useState(false)

  async function loadCounts() {
    const [{ count: likes }, { count: cmts }, { count: reposts }] = await Promise.all([
      supabase.from('post_likes').select('id', { count: 'exact', head: true }).eq('post_id', postId),
      supabase.from('post_comments').select('id', { count: 'exact', head: true }).eq('post_id', postId),
      supabase.from('posts').select('id', { count: 'exact', head: true }).eq('repost_of_post_id', postId),
    ])
    setLikeCount(likes ?? 0)
    setCommentCount(cmts ?? 0)
    setRepostCount(reposts ?? 0)

    if (user) {
      const { data: userRow } = await supabase.from('users').select('id').eq('clerk_id', user.id).single()
      if (userRow) {
        const [{ data: likeRow }, { data: repostRow }] = await Promise.all([
          supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', userRow.id).single(),
          supabase.from('posts').select('id').eq('repost_of_post_id', postId).eq('author_user_id', userRow.id).single(),
        ])
        setLiked(!!likeRow)
        setReposted(!!repostRow)
      }
    }
  }

  useEffect(() => { loadCounts() }, [postId, user])

  async function toggleLike() {
    if (!user) { router.push('/login'); return }
    if (busy) return
    setBusy(true)
    try {
      const userId = await ensureUserRow(supabase, user)
      if (liked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
        setLiked(false)
        setLikeCount((c) => Math.max(0, c - 1))
      } else {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
        setLiked(true)
        setLikeCount((c) => c + 1)
      }
    } finally {
      setBusy(false)
    }
  }

  async function toggleRepost() {
    if (!user) { router.push('/login'); return }
    if (reposting) return
    setReposting(true)
    try {
      const userId = await ensureUserRow(supabase, user)
      if (reposted) {
        await supabase.from('posts').delete().eq('repost_of_post_id', postId).eq('author_user_id', userId)
        setReposted(false)
        setRepostCount((c) => Math.max(0, c - 1))
      } else {
        await supabase.from('posts').insert({ author_user_id: userId, repost_of_post_id: postId })
        setReposted(true)
        setRepostCount((c) => c + 1)
        onReposted?.()
      }
    } finally {
      setReposting(false)
    }
  }

  async function share() {
    const url = typeof window !== 'undefined' ? `${window.location.origin}${shareUrl}` : shareUrl
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ url })
        return
      } catch {
        // fall through to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable - nothing more we can do
    }
  }

  async function loadComments() {
    const { data } = await supabase
      .from('post_comments')
      .select('*, author:users(name, avatar_url, slug)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    setComments(data ?? [])
  }

  function toggleComments() {
    const next = !showComments
    setShowComments(next)
    if (next) loadComments()
  }

  async function submitComment() {
    if (!user) { router.push('/login'); return }
    if (commentText.trim().length === 0) return
    setPosting(true)
    try {
      const userId = await ensureUserRow(supabase, user)
      await supabase.from('post_comments').insert({ post_id: postId, author_user_id: userId, text: commentText.trim() })
      setCommentText('')
      setCommentCount((c) => c + 1)
      loadComments()
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-merqt-border">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggleLike}
          className={`flex items-center gap-1.5 text-xs font-semibold ${liked ? 'text-merqt-ochre-dark' : 'text-merqt-text-muted'}`}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
          {likeCount > 0 ? likeCount : 'Like'}
        </button>

        <button
          type="button"
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-xs font-semibold text-merqt-text-muted"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {commentCount > 0 ? commentCount : 'Comment'}
        </button>

        <button
          type="button"
          onClick={toggleRepost}
          disabled={reposting}
          className={`flex items-center gap-1.5 text-xs font-semibold ${reposted ? 'text-merqt-success-dark' : 'text-merqt-text-muted'}`}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 2 21 6l-4 4" /><path d="M3 11V9a2 2 0 0 1 2-2h16" />
            <path d="M7 22 3 18l4-4" /><path d="M21 13v2a2 2 0 0 1-2 2H3" />
          </svg>
          {repostCount > 0 ? repostCount : reposted ? 'Reposted' : 'Repost'}
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={share}
          className="flex items-center gap-1.5 text-xs font-semibold text-merqt-text-muted"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <path d="m8.6 10.5 6.8-3.9M8.6 13.5l6.8 3.9" />
          </svg>
          {copied ? 'Link copied' : 'Share'}
        </button>
      </div>

      {showComments && (
        <div className="mt-2.5 space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar src={c.author?.avatar_url} name={c.author?.name || 'User'} size={22} />
              <div className="flex-1 bg-merqt-bg rounded px-2.5 py-1.5">
                <span className="text-xs font-semibold mr-1.5">{c.author?.name || 'User'}</span>
                <span className="text-xs">{c.text}</span>
              </div>
            </div>
          ))}
          {user && (
            <div className="flex items-center gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitComment() }}
                placeholder="Write a comment..."
                className="flex-1 border border-merqt-border rounded-full px-3 py-1.5 text-xs outline-none focus:border-merqt-indigo"
              />
              <button
                type="button"
                onClick={submitComment}
                disabled={posting || commentText.trim().length === 0}
                className="text-xs font-semibold text-merqt-indigo disabled:text-merqt-text-muted flex-shrink-0"
              >
                Post
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
