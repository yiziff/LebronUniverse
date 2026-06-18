import type { CareerMilestone, PlayerCareerEvent } from '../types'
import { UI } from '../styles/uiTypography'

interface Props {
  realMilestones: CareerMilestone[]
  parallelEvents: PlayerCareerEvent[]
  starColor: string
}

export default function PlayerCareerTimeline({
  realMilestones,
  parallelEvents,
  starColor,
}: Props) {
  const hasParallel = parallelEvents.length > 0

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ color: '#94a3b8', fontSize: UI.bodySmall, fontWeight: 700, marginBottom: 8 }}>
        📜 生涯时间线（只读 · 由詹姆斯选择推导）
      </div>

      <div style={{ color: starColor, fontSize: UI.caption, fontWeight: 700, marginBottom: 6, marginTop: 8, opacity: 0.85 }}>
        真实历史
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {realMilestones.map((m) => (
          <div
            key={`real_${m.timestamp}_${m.title}`}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              background: `${starColor}08`,
              borderLeft: `3px solid ${starColor}`,
              opacity: 0.78,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ color: starColor, fontSize: UI.caption, flexShrink: 0, opacity: 0.75 }}>
                {m.timestamp.slice(0, 4)}
              </span>
              <span style={{ color: '#94a3b8', fontSize: UI.body, fontWeight: 600 }}>
                {m.title}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: UI.bodySmall, color: '#64748b', lineHeight: UI.lineHeight }}>
              {m.description}
            </p>
          </div>
        ))}
      </div>

      <div style={{ color: starColor, fontSize: UI.caption, fontWeight: 700, marginBottom: 6, marginTop: 12 }}>
        平行宇宙 {hasParallel ? `(${parallelEvents.length})` : ''}
      </div>
      {!hasParallel ? (
        <p style={{ margin: 0, fontSize: UI.bodySmall, color: '#64748b' }}>
          推演进行中，平行生涯节点将陆续出现…
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {parallelEvents.map((ev) => (
            <div
              key={ev.id}
              style={{
                padding: '9px 11px',
                borderRadius: 6,
                background: 'rgba(0,0,0,0.25)',
                borderLeft: `3px solid ${starColor}`,
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ color: '#64748b', fontSize: UI.caption, flexShrink: 0 }}>
                  {ev.timestamp.slice(0, 4)}
                </span>
                <span style={{ color: '#e2e8f0', fontSize: UI.body, fontWeight: 600 }}>
                  {ev.title}
                </span>
                {ev.forkId && (
                  <span style={{ fontSize: UI.caption, color: '#fbbf24', marginLeft: 'auto' }}>
                    因詹姆斯选择
                  </span>
                )}
              </div>
              <p style={{ margin: '5px 0 0', fontSize: UI.bodySmall, color: '#94a3b8', lineHeight: UI.lineHeightRelaxed }}>
                {ev.description}
              </p>
              {ev.vsRealHistory && (
                <p style={{ margin: '5px 0 0', fontSize: UI.caption, color: '#64748b', fontStyle: 'italic', lineHeight: UI.lineHeight }}>
                  ↔ {ev.vsRealHistory}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
