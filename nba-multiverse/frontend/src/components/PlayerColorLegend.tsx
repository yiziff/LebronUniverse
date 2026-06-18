import { KEY_PLAYERS, playerColor } from '../data/keyPlayers'
import { UI } from '../styles/uiTypography'

export default function PlayerColorLegend() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 72,
        left: 16,
        zIndex: 10,
        background: 'rgba(10,10,30,0.88)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '10px 14px',
        maxWidth: 220,
      }}
    >
      <div style={{ color: '#94a3b8', fontSize: UI.caption, fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>
        球星故事线配色
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {KEY_PLAYERS.map((p) => {
          const color = playerColor(p.id)
          return (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 8px ${color}88`,
                  flexShrink: 0,
                }}
              />
              <span style={{ color, fontSize: UI.bodySmall, fontWeight: 600 }}>{p.nameZh}</span>
              {p.id === 'lebron-james' && (
                <span style={{ color: '#64748b', fontSize: UI.caption, marginLeft: 'auto' }}>可操控</span>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ color: '#64748b', fontSize: UI.caption, marginTop: 8, lineHeight: UI.lineHeight }}>
        同色球体 = 同一球星 · 较暗为真实历史 · 较亮为平行宇宙
      </div>
    </div>
  )
}
