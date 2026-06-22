import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { UI, UI_WIDTH } from '../styles/uiTypography'
import gsap from 'gsap'

export default function EventNarrativePanel() {
  const narrativeEvents = useStore((s) => s.narrativeEvents)
  const featuredEventId = useStore((s) => s.featuredEventId)
  const phase = useStore((s) => s.phase)
  const activeTeamColor = useStore((s) => s.activeTeamColor)
  const setFeaturedEvent = useStore((s) => s.setFeaturedEvent)

  const cardRef = useRef<HTMLDivElement>(null)
  const prevFeatured = useRef<string | null>(null)

  const featured =
    narrativeEvents.find((e) => e.id === featuredEventId) ??
    narrativeEvents[narrativeEvents.length - 1]

  useEffect(() => {
    if (!featured || featured.id === prevFeatured.current) return
    prevFeatured.current = featured.id
    if (!cardRef.current) return
    gsap.fromTo(
      cardRef.current,
      { x: -20, opacity: 0, scale: 0.96 },
      { x: 0, opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(1.4)' },
    )
  }, [featured?.id])

  if (!featured && phase !== 'generating') return null

  const history = narrativeEvents.filter((e) => e.id !== featured?.id).slice(-4)

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 10,
        width: `min(${UI_WIDTH.narrativePanel}px, 36vw)`,
        maxHeight: 'min(340px, calc(100vh - 320px))',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        pointerEvents: 'none',
      }}
    >
      {phase === 'generating' && !featured && (
        <div
          style={{
            background: 'rgba(10,10,30,0.88)',
            border: `1px solid ${activeTeamColor}44`,
            borderRadius: 10,
            padding: '12px 14px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: UI.bodySmall,
          }}
        >
          ⚡ 平行宇宙正在写入……
        </div>
      )}

      {featured && (
        <div
          ref={cardRef}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(8,8,24,0.88)',
            border: `1px solid ${featured.teamColor}55`,
            borderRadius: 10,
            padding: '10px 12px',
            boxShadow: `0 6px 24px ${featured.teamColor}18, 0 0 40px ${featured.teamColor}0a`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 6,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                color: featured.teamColor,
                background: `${featured.teamColor}22`,
                padding: '2px 7px',
                borderRadius: 4,
              }}
            >
              {featured.isBranch ? '⚡ 平行宇宙' : '📜 历史节点'}
            </span>
            <span style={{ color: '#64748b', fontSize: UI.caption }}>{featured.timestamp}</span>
            {featured.teamsAffected && featured.teamsAffected.length > 0 && (
              <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 11 }}>
                {featured.teamsAffected.join(' · ')}
              </span>
            )}
          </div>

          <h2
            style={{
              margin: '0 0 6px',
              color: '#f1f5f9',
              fontSize: UI.bodyLarge,
              fontWeight: 700,
              lineHeight: 1.35,
            }}
          >
            {featured.title}
          </h2>

          <p
            style={{
              margin: 0,
              color: '#cbd5e1',
              fontSize: UI.bodySmall,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {featured.description}
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div
          style={{
            marginTop: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            pointerEvents: 'auto',
          }}
        >
          {history.reverse().map((evt) => (
            <button
              key={evt.id}
              type="button"
              onClick={() => setFeaturedEvent(evt.id)}
              style={{
                textAlign: 'left',
                background: 'rgba(10,10,30,0.72)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 6,
                padding: '6px 10px',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: UI.caption,
                lineHeight: 1.45,
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(10,10,30,0.75)'
              }}
            >
              <span style={{ color: evt.teamColor, marginRight: 8 }}>{evt.timestamp}</span>
              {evt.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
