import type { SocialPost as SocialPostType } from '../types'

const SENTIMENT_COLORS: Record<string, string> = {
  angry: '#ef4444',
  excited: '#f59e0b',
  sarcastic: '#a855f7',
  shocked: '#3b82f6',
  hate: '#991b1b',
}

const SENTIMENT_LABELS: Record<string, string> = {
  angry: '😡 愤怒',
  excited: '🎉 兴奋',
  sarcastic: '😏 阴阳',
  shocked: '😱 震惊',
  hate: '💀 暴击',
}

export default function SocialPostCard({ post }: { post: SocialPostType }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderLeft: `3px solid ${SENTIMENT_COLORS[post.sentiment] ?? '#888'}`,
        background: 'rgba(15,15,35,0.9)',
        borderRadius: '0 8px 8px 0',
        marginBottom: 8,
        transition: 'transform 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.02)'
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
      }}
    >
      {/* User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: post.avatarColor,
            flexShrink: 0,
          }}
        />
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
          {post.username}
        </span>
        <span style={{ color: '#94a3b8', fontSize: 11 }}>{post.handle}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 9,
            color: SENTIMENT_COLORS[post.sentiment],
            background: `${SENTIMENT_COLORS[post.sentiment]}22`,
            padding: '1px 5px',
            borderRadius: 4,
          }}
        >
          {SENTIMENT_LABELS[post.sentiment]}
        </span>
      </div>

      {/* Content */}
      <p style={{ color: '#cbd5e1', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
        {post.content}
      </p>
    </div>
  )
}
