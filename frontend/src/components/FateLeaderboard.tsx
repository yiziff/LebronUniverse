import * as THREE from 'three'
import { useStore } from '../store'
import { playerNameZh } from '../utils/inferPlayerImpact'
import { UI, UI_WIDTH } from '../styles/uiTypography'
import { cameraBridge } from '../engine/CameraController'
import { playerColor } from '../data/keyPlayers'
import { resolveParallelBranchTip } from '../utils/parallelForkLayout'
import { FORK_ORDER } from '../utils/loadMasterTimeline'
import PlayerCareerTimeline from './PlayerCareerTimeline'

export default function FateLeaderboard() {
  const playerFates = useStore((s) => s.playerFates)
  const playerStars = useStore((s) => s.playerStars)
  const phase = useStore((s) => s.phase)
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const rpgStats = useStore((s) => s.rpgStats)
  const completedForks = useStore((s) => s.completedForks)
  const narrativeEvents = useStore((s) => s.narrativeEvents)
  const selectedPlayerId = useStore((s) => s.selectedPlayerId)
  const selectedNpcNodeId = useStore((s) => s.selectedNpcNodeId)
  const npcTimelineNodes = useStore((s) => s.npcTimelineNodes)
  const setSelectedPlayerId = useStore((s) => s.setSelectedPlayerId)
  const setFeaturedEvent = useStore((s) => s.setFeaturedEvent)
  const pulsingPlayerIds = useStore((s) => s.pulsingPlayerIds)

  const jamesStar = playerStars.find((p) => p.id === 'lebron-james')
  const jamesRealCount = nodes.filter(
    (n) => !n.hidden && n.isRealHistory && n.type === 'event',
  ).length
  const jamesParCount = nodes.filter(
    (n) => !n.hidden && !n.isRealHistory && n.type === 'event',
  ).length

  const npcStars = playerStars.filter((p) => p.id !== 'lebron-james')

  const npcList = npcStars.map((p) => {
    const visible = npcTimelineNodes.filter((n) => n.playerId === p.id && !n.hidden)
    const realCount = visible.filter((n) => n.segmentKind === 'real').length
    const parCount = visible.filter((n) => n.segmentKind === 'parallel').length
    const fate = playerFates[p.id]
    return { ...p, realCount, parCount, fate, swing: fate?.totalSwing ?? 0 }
  })

  const swingRanked = [...npcList]
    .filter((x) => x.swing > 0)
    .sort((a, b) => b.swing - a.swing)

  const showLegacyRank = completedForks.length > 0 || phase === 'complete'
  const legacyRanked = [...playerStars]
    .map((p) => {
      const legacy =
        p.id === 'lebron-james' ? rpgStats.legacy : (playerFates[p.id]?.legacy ?? 50)
      return {
        id: p.id,
        nameZh: p.nameZh,
        color: p.color,
        legacy,
        delta: legacy - 50,
      }
    })
    .sort((a, b) => b.legacy - a.legacy)

  const selectedNpcNode = selectedNpcNodeId
    ? npcTimelineNodes.find((n) => n.id === selectedNpcNodeId)
    : null

  const flyToJamesParallelChain = () => {
    let tip = nodes
      .filter((n) => !n.hidden && !n.isRealHistory && n.type === 'event')
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .at(-1) ?? null

    if (!tip && completedForks.length > 0) {
      const lastFork = completedForks[completedForks.length - 1]
      tip = resolveParallelBranchTip(lastFork, nodes, edges)
    }

    if (!tip) {
      const activeFork = FORK_ORDER.find(
        (id) => !completedForks.includes(id),
      )
      const forkNode = activeFork
        ? nodes.find((n) => n.id === activeFork && !n.hidden)
        : null
      if (forkNode && cameraBridge.flyToBranch) {
        cameraBridge.flyToBranch(
          new THREE.Vector3(
            forkNode.position.x + 2,
            forkNode.position.y,
            forkNode.position.z,
          ),
        )
      }
      return
    }

    const branchNarrative = narrativeEvents
      .filter((e) => e.isBranch)
      .at(-1)
    if (branchNarrative) setFeaturedEvent(branchNarrative.id)

    if (cameraBridge.flyToBranch) {
      cameraBridge.flyToBranch(
        new THREE.Vector3(
          tip.position.x + 1.5,
          tip.position.y,
          tip.position.z,
        ),
      )
    }
  }

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

      {showLegacyRank && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              color: '#94a3b8',
              fontSize: UI.caption,
              fontWeight: 700,
              marginBottom: 6,
              letterSpacing: 0.5,
            }}
          >
            历史地位排行
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
              gap: 4,
            }}
          >
            {legacyRanked.map((p, idx) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 8px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span
                  style={{
                    color: idx < 3 ? '#f59e0b' : '#64748b',
                    fontSize: UI.caption,
                    fontWeight: 700,
                    width: 14,
                  }}
                >
                  {idx + 1}
                </span>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: p.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: p.color, fontSize: UI.caption, fontWeight: 600 }}>
                  {p.nameZh}
                </span>
                <span style={{ marginLeft: 'auto', color: '#e2e8f0', fontSize: UI.caption }}>
                  {Math.round(p.legacy)}
                </span>
                <span
                  style={{
                    color: p.delta >= 0 ? '#4ade80' : '#ef4444',
                    fontSize: 11,
                  }}
                >
                  {p.delta >= 0 ? '+' : ''}{Math.round(p.delta)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ color: '#64748b', fontSize: UI.caption, margin: '0 0 8px', lineHeight: UI.lineHeight }}>
        勒布朗走中央金色主轴；其他球星为辐射线。较暗为真实历史，较亮为平行宇宙。
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {jamesStar && (
          <button
            type="button"
            onClick={flyToJamesParallelChain}
            style={{
              flex: '1 1 100%',
              textAlign: 'left',
              background: 'rgba(212,168,83,0.12)',
              border: `1px solid ${playerColor('lebron-james')}66`,
              borderRadius: 8,
              padding: '8px 10px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: jamesStar.color,
                  boxShadow: `0 0 6px ${jamesStar.color}88`,
                }}
              />
              <span style={{ color: jamesStar.color, fontSize: UI.body, fontWeight: 700 }}>
                {jamesStar.nameZh}
              </span>
              <span style={{ color: '#64748b', fontSize: UI.caption }}>可操控 · 中央主轴</span>
              <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: UI.caption }}>
                真实 {jamesRealCount} · 平行 {jamesParCount}
              </span>
            </div>
            {jamesParCount > 0 && (
              <div style={{ marginTop: 4, fontSize: UI.caption, color: '#94a3b8' }}>
                点击定位詹姆斯平行宇宙链 · 历史地位 {Math.round(rpgStats.legacy)}
              </div>
            )}
          </button>
        )}

        {npcList.map((p) => {
          const isSelected = selectedPlayerId === p.id
          const isPulsing = pulsingPlayerIds.includes(p.id)
          const rankIdx = swingRanked.findIndex((r) => r.id === p.id)
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

      {selectedPlayerId && selectedPlayerId !== 'lebron-james' && (
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
