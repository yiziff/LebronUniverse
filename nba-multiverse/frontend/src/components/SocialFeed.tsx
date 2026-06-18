import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import SocialPostCard from './SocialPost'
import gsap from 'gsap'

const MAX_VISIBLE = 5
const FADE_MS = 8000

export default function SocialFeed() {
  const posts = useStore((s) => s.posts)
  const phase = useStore((s) => s.phase)
  const feedRef = useRef<HTMLDivElement>(null)
  const prevPostCount = useRef(0)
  const [hovered, setHovered] = useState(false)
  const [fadedIds, setFadedIds] = useState<Set<string>>(new Set())

  const visiblePosts = posts
    .filter((p) => !fadedIds.has(p.id))
    .slice(-MAX_VISIBLE)

  useEffect(() => {
    if (posts.length > prevPostCount.current && feedRef.current) {
      const cards = feedRef.current.querySelectorAll('.social-post-card')
      const latest = cards[cards.length - 1] as HTMLElement
      if (latest) {
        gsap.fromTo(
          latest,
          { x: -320, opacity: 0, scale: 0.92 },
          { x: 0, opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.2)' },
        )
      }
    }
    prevPostCount.current = posts.length
  }, [posts.length])

  // Auto-fade old posts unless hovered
  useEffect(() => {
    if (hovered || posts.length === 0) return
    const timers: ReturnType<typeof setTimeout>[] = []
    posts.forEach((post, idx) => {
      const delay = Math.max(0, FADE_MS - (posts.length - 1 - idx) * 400)
      timers.push(
        setTimeout(() => {
          if (!hovered) {
            setFadedIds((prev) => new Set(prev).add(post.id))
          }
        }, delay),
      )
    })
    return () => timers.forEach(clearTimeout)
  }, [posts, hovered])

  useEffect(() => {
    if (phase === 'generating' && posts.length === 0) {
      setFadedIds(new Set())
    }
  }, [phase, posts.length])

  const showPlaceholder = phase === 'generating' && posts.length === 0

  if (!showPlaceholder && visiblePosts.length === 0 && posts.length === 0) return null

  return (
    <div
      ref={feedRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        left: 16,
        top: 'auto',
        bottom: 100,
        zIndex: 10,
        width: 300,
        maxHeight: '55vh',
        overflowY: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      <div
        style={{
          color: '#64748b',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          marginBottom: 8,
          textTransform: 'uppercase',
        }}
      >
        📱 虚拟舆论
      </div>

      {showPlaceholder && (
        <div
          style={{
            background: 'rgba(10,10,30,0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '12px 14px',
            color: '#64748b',
            fontSize: 12,
            marginBottom: 8,
            animation: 'pulse 2s infinite',
          }}
        >
          📡 名嘴和球迷正在疯狂发推……
        </div>
      )}

      {visiblePosts.map((post) => (
        <div key={post.id} className="social-post-card">
          <SocialPostCard post={post} />
        </div>
      ))}

      {posts.length > 0 && (
        <p
          style={{
            color: '#64748b',
            fontSize: 10,
            textAlign: 'center',
            marginTop: 4,
          }}
        >
          以上内容由 AI 生成，仅为娱乐效果
        </p>
      )}
    </div>
  )
}
