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
        top: 16,
        left: 16,
        zIndex: 10,
        width: `min(${UI_WIDTH.narrativePanel}px, 42vw)`,
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        pointerEvents: 'none',
      }}
    >
      {phase === 'generating' && !featured && (
        <div
          style={{
            background: 'rgba(10,10,30,0.9)',
            border: `1px solid ${activeTeamColor}44`,
            borderRadius: 14,
            padding: '18px 22px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: UI.bodyLarge,
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
            background: 'rgba(8,8,24,0.92)',
            border: `1px solid ${featured.teamColor}66`,
            borderRadius: 14,
            padding: '18px 22px',
            boxShadow: `0 8px 32px ${featured.teamColor}22, 0 0 60px ${featured.teamColor}11`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: UI.caption,
                fontWeight: 700,
                letterSpacing: 1,
                color: featured.teamColor,
                background: `${featured.teamColor}22`,
                padding: '4px 10px',
                borderRadius: 4,
              }}
            >
              {featured.isBranch ? '⚡ 平行宇宙' : '📜 历史节点'}
            </span>
            <span style={{ color: '#64748b', fontSize: UI.bodySmall }}>{featured.timestamp}</span>
            {featured.teamsAffected && featured.teamsAffected.length > 0 && (
              <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: UI.caption }}>
                {featured.teamsAffected.join(' · ')}
              </span>
            )}
          </div>

          <h2
            style={{
              margin: '0 0 12px',
              color: '#f1f5f9',
              fontSize: UI.title,
              fontWeight: 700,
              lineHeight: 1.3,
            }}
          >
            {featured.title}
          </h2>

          <p
            style={{
              margin: 0,
              color: '#cbd5e1',
              fontSize: UI.bodyLarge,
              lineHeight: UI.lineHeightRelaxed,
            }}
          >
            {featured.description}
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
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
                background: 'rgba(10,10,30,0.75)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                padding: '10px 14px',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: UI.bodySmall,
                lineHeight: UI.lineHeight,
                transition: 'background 0.15s',
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
