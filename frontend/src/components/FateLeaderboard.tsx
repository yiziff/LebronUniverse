import { useStore } from '../store'
import { playerNameZh } from '../utils/inferPlayerImpact'
import { UI, UI_WIDTH } from '../styles/uiTypography'
import PlayerCareerTimeline from './PlayerCareerTimeline'

export default function FateLeaderboard() {
  const playerFates = useStore((s) => s.playerFates)
  const playerStars = useStore((s) => s.playerStars)
  const phase = useStore((s) => s.phase)
  const selectedPlayerId = useStore((s) => s.selectedPlayerId)
  const selectedNpcNodeId = useStore((s) => s.selectedNpcNodeId)
  const npcTimelineNodes = useStore((s) => s.npcTimelineNodes)
  const setSelectedPlayerId = useStore((s) => s.setSelectedPlayerId)
  const pulsingPlayerIds = useStore((s) => s.pulsingPlayerIds)

  const npcStars = playerStars.filter((p) => p.id !== 'lebron-james')

  const npcList = npcStars.map((p) => {
    const visible = npcTimelineNodes.filter((n) => n.playerId === p.id && !n.hidden)
    const realCount = visible.filter((n) => n.segmentKind === 'real').length
    const parCount = visible.filter((n) => n.segmentKind === 'parallel').length
    const fate = playerFates[p.id]
    return { ...p, realCount, parCount, fate, swing: fate?.totalSwing ?? 0 }
  })

  const ranked = [...npcList]
    .filter((x) => x.swing > 0)
    .sort((a, b) => b.swing - a.swing)

  const selectedNpcNode = selectedNpcNodeId
    ? npcTimelineNodes.find((n) => n.id === selectedNpcNodeId)
    : null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        width: `min(${UI_WIDTH.fateLeaderboard}px, 94vw)`,
        background: 'rgba(6,6,20,0.92)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '12px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ color: '#94a3b8', fontSize: UI.panelTitle, fontWeight: 700, letterSpacing: 1 }}>
          球星故事线 · 只读观察
        </span>
        <span style={{ color: '#64748b', fontSize: UI.caption }}>
          {phase === 'generating' ? '蝴蝶效应传播中…' : '点击星体或球体查看生涯'}
        </span>
      </div>

      <p style={{ color: '#64748b', fontSize: UI.caption, margin: '0 0 8px', lineHeight: UI.lineHeight }}>
        开局可见真实 NBA 生涯（较暗）；替詹姆斯做选择后，亮色平行链会从分叉点改写 TA 的命运。
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {npcList.map((p) => {
          const isSelected = selectedPlayerId === p.id
          const isPulsing = pulsingPlayerIds.includes(p.id)
          const rankIdx = ranked.findIndex((r) => r.id === p.id)
          const brightness = Math.min(p.swing / 80, 1)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPlayerId(isSelected ? null : p.id)}
              style={{
                flex: '1 1 160px',
                textAlign: 'left',
                background: isSelected ? `${p.color}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isSelected || isPulsing ? p.color : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 8,
                padding: '8px 10px',
                cursor: 'pointer',
                animation: isPulsing ? 'pulse 0.8s ease-in-out' : undefined,
                boxShadow: brightness > 0.3 ? `0 0 ${8 + brightness * 12}px ${p.color}44` : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {rankIdx >= 0 && (
                  <span
                    style={{
                      color: rankIdx < 3 ? '#f59e0b' : '#64748b',
                      fontSize: UI.bodySmall,
                      fontWeight: 700,
                      width: 16,
                    }}
                  >
                    {rankIdx + 1}
                  </span>
                )}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: p.color,
                    boxShadow: `0 0 6px ${p.color}88`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: p.color, fontSize: UI.body, fontWeight: 700 }}>
                  {p.nameZh}
                </span>
                <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: UI.caption }}>
                  真实 {p.realCount} · 平行 {p.parCount}
                </span>
              </div>
              {p.swing > 0 && (
                <div style={{ marginTop: 4, fontSize: UI.caption, color: '#94a3b8' }}>
                  命运波动 {Math.round(p.swing)}
                  {p.fate?.lastReason && (
                    <span style={{ color: '#64748b' }}> · {p.fate.lastReason}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {selectedPlayerId && (
        <PlayerFateDetail
          playerId={selectedPlayerId}
          highlightNode={selectedNpcNode}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  )
}

function PlayerFateDetail({
  playerId,
  highlightNode,
  onClose,
}: {
  playerId: string
  highlightNode?: { label: string; description?: string; vsRealHistory?: string; timestamp: string } | null
  onClose: () => void
}) {
  const fate = useStore((s) => s.playerFates[playerId])
  const star = useStore((s) => s.playerStars.find((p) => p.id === playerId))
  const careerEvents = useStore((s) => s.playerCareerEvents[playerId] ?? [])
  const careerMilestones = useStore((s) => s.careerMilestones[playerId])
  if (!star) return null

  const rows = fate && fate.totalSwing > 0
    ? [
        { label: '历史地位', value: fate.legacy, delta: fate.legacy - 50 },
        { label: '冠军机会', value: fate.ringChance, delta: fate.ringChance - 50 },
        { label: '舆论热度', value: fate.mediaHeat, delta: fate.mediaHeat - 50 },
        { label: '球队处境', value: fate.teamFit, delta: fate.teamFit - 50 },
      ]
    : []

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        border: `1px solid ${star.color}44`,
        maxHeight: 380,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: star.color, fontWeight: 700, fontSize: UI.bodyLarge }}>
          {playerNameZh(playerId)} · 生涯故事
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ✕
        </button>
      </div>

      <p style={{ color: '#64748b', fontSize: UI.caption, margin: '6px 0 0', lineHeight: UI.lineHeight }}>
        这是 TA 在真实 NBA 中的生涯；替詹姆斯做选择后，亮色平行链会从这里改写 TA 的命运。
      </p>

      {highlightNode && (
        <div
          style={{
            marginTop: 8,
            padding: '8px 10px',
            background: `${star.color}11`,
            borderRadius: 6,
            border: `1px solid ${star.color}55`,
          }}
        >
          <div style={{ color: star.color, fontSize: UI.body, fontWeight: 700 }}>
            {highlightNode.label}
          </div>
          <div style={{ color: '#94a3b8', fontSize: UI.bodySmall, marginTop: 6, lineHeight: UI.lineHeight }}>
            {highlightNode.description ?? '暂无详细描述'}
          </div>
          {highlightNode.vsRealHistory && (
            <div style={{ color: '#64748b', fontSize: UI.caption, marginTop: 6, fontStyle: 'italic', lineHeight: UI.lineHeight }}>
              vs 真实历史：{highlightNode.vsRealHistory}
            </div>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ fontSize: UI.bodySmall }}>
              <span style={{ color: '#64748b' }}>{r.label} </span>
              <span style={{ color: '#e2e8f0' }}>{Math.round(r.value)}</span>
              <span style={{ color: r.delta >= 0 ? '#4ade80' : '#ef4444', marginLeft: 4 }}>
                ({r.delta >= 0 ? '+' : ''}{Math.round(r.delta)})
              </span>
            </div>
          ))}
        </div>
      )}

      <PlayerCareerTimeline
        realMilestones={careerMilestones?.real_milestones ?? []}
        parallelEvents={careerEvents}
        starColor={star.color}
      />
    </div>
  )
}
