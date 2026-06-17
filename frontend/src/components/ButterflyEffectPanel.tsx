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
        right: 16,
        zIndex: 12,
        width: `min(${UI_WIDTH.butterflyPanel}px, 88vw)`,
        background: 'rgba(6,6,22,0.92)',
        border: '1px solid rgba(251,191,36,0.25)',
        borderRadius: 12,
        padding: '12px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: '#fbbf24', fontSize: UI.panelTitle, fontWeight: 700, letterSpacing: 0.5 }}>
          🦋 蝴蝶效应 · 因果链
        </div>
        {activeChoiceLabel && (
          <div style={{ color: '#94a3b8', fontSize: UI.bodySmall, marginTop: 4 }}>
            最新选择：<span style={{ color: '#e2e8f0' }}>{activeChoiceLabel}</span>
          </div>
        )}
        {jamesChoices.length > 0 && (
          <div style={{ color: '#64748b', fontSize: UI.caption, marginTop: 5 }}>
            {jamesChoices.map((c) => getForkLabel(c.fork_id)).join(' → ')}
          </div>
        )}
      </div>

      {orderedGroups.map((forkId) => {
        const groupEntries = [...(grouped.get(forkId) ?? [])].reverse().slice(0, 4)
        return (
          <div key={forkId} style={{ marginBottom: 12 }}>
            <div
              style={{
                color: '#f59e0b',
                fontSize: UI.caption,
                fontWeight: 700,
                marginBottom: 6,
                paddingBottom: 5,
                borderBottom: '1px solid rgba(251,191,36,0.15)',
              }}
            >
              {getForkLabel(forkId)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {groupEntries.map((e) => {
                const color = playerStars.find((p) => p.id === e.playerId)?.color ?? '#888'
                const net = netDelta(e)
                return (
                  <div
                    key={e.id}
                    style={{
                      padding: '9px 11px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${color}33`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color, fontWeight: 700, fontSize: UI.body }}>
                        {playerNameZh(e.playerId)}
                      </span>
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: UI.bodySmall,
                          fontWeight: 700,
                          color: net >= 0 ? '#4ade80' : '#f87171',
                        }}
                      >
                        {net >= 0 ? '↑' : '↓'} {fmtDelta(net)}
                      </span>
                    </div>
                    <div style={{ fontSize: UI.caption, color: '#64748b', marginTop: 4 }}>
                      {e.source === 'choice' ? '⚡ 选择冲击' : '📅 事件余波'}
                      {e.eventTitle ? ` · ${e.eventTitle.slice(0, 14)}` : ''}
                    </div>
                    <div style={{ fontSize: UI.bodySmall, color: '#94a3b8', marginTop: 4, lineHeight: UI.lineHeight }}>
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
