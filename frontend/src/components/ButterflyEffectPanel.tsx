import { useMemo } from 'react'
import { useStore } from '../store'
import { playerNameZh } from '../utils/inferPlayerImpact'
import { UI, UI_WIDTH } from '../styles/uiTypography'

function fmtDelta(n: number): string {
  if (n === 0) return '±0'
  return n > 0 ? `+${Math.round(n)}` : `${Math.round(n)}`
}

function netDelta(e: { legacy: number; ringChance: number; mediaHeat: number; teamFit: number }): number {
  return e.legacy + e.ringChance + e.mediaHeat + e.teamFit
}

export default function ButterflyEffectPanel() {
  const entries = useStore((s) => s.butterflyEntries)
  const activeChoiceLabel = useStore((s) => s.activeChoiceLabel)
  const jamesChoices = useStore((s) => s.jamesChoices)
  const playerStars = useStore((s) => s.playerStars)
  const phase = useStore((s) => s.phase)
  const getForkLabel = useStore((s) => s.getForkLabel)

  const show = (phase === 'generating' || phase === 'complete') && entries.length > 0

  const grouped = useMemo(() => {
    const map = new Map<string, typeof entries>()
    for (const e of entries) {
      const key = e.forkId ?? 'unknown'
      const list = map.get(key) ?? []
      list.push(e)
      map.set(key, list)
    }
    return map
  }, [entries])

  const forkOrder = ['evt_lebron_2010', 'evt_lebron_2014', 'evt_lebron_2017', 'evt_lebron_2018']
  const orderedGroups = forkOrder.filter((id) => grouped.has(id))

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 88,
        right: 12,
        zIndex: 12,
        width: `min(${UI_WIDTH.butterflyPanel}px, 72vw)`,
        background: 'rgba(6,6,22,0.88)',
        border: '1px solid rgba(251,191,36,0.2)',
        borderRadius: 10,
        padding: '8px 10px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
        maxHeight: 'min(360px, calc(100vh - 320px))',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <div style={{ color: '#fbbf24', fontSize: UI.caption, fontWeight: 700, letterSpacing: 0.3 }}>
          🦋 蝴蝶效应 · 因果链
        </div>
        {activeChoiceLabel && (
          <div style={{ color: '#94a3b8', fontSize: UI.caption, marginTop: 2 }}>
            最新选择：<span style={{ color: '#e2e8f0' }}>{activeChoiceLabel}</span>
          </div>
        )}
        {jamesChoices.length > 0 && (
          <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
            {jamesChoices.map((c) => getForkLabel(c.fork_id)).join(' → ')}
          </div>
        )}
      </div>

      {orderedGroups.map((forkId) => {
        const groupEntries = [...(grouped.get(forkId) ?? [])].reverse().slice(0, 4)
        return (
          <div key={forkId} style={{ marginBottom: 8 }}>
            <div
              style={{
                color: '#f59e0b',
                fontSize: 11,
                fontWeight: 700,
                marginBottom: 4,
                paddingBottom: 3,
                borderBottom: '1px solid rgba(251,191,36,0.12)',
              }}
            >
              {getForkLabel(forkId)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {groupEntries.map((e) => {
                const color = playerStars.find((p) => p.id === e.playerId)?.color ?? '#888'
                const net = netDelta(e)
                return (
                  <div
                    key={e.id}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${color}28`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color, fontWeight: 700, fontSize: UI.bodySmall }}>
                        {playerNameZh(e.playerId)}
                      </span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: UI.caption,
                          fontWeight: 700,
                          color: net >= 0 ? '#4ade80' : '#f87171',
                          flexShrink: 0,
                        }}
                      >
                        {net >= 0 ? '↑' : '↓'} {fmtDelta(net)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: UI.caption,
                        color: '#94a3b8',
                        marginTop: 3,
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {e.reason}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
