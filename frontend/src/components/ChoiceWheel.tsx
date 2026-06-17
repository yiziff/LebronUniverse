import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useSSE } from '../hooks/useSSE'
import ChoiceCard from './ChoiceCard'
import type { ChoiceData } from '../types'
import { fetchUniverseData } from '../utils/loadMasterTimeline'

const FORK_HEADERS: Record<string, { title: string; subtitle: string }> = {
  evt_lebron_2010: { title: '2010 年夏天', subtitle: '决定一 · 勒布朗·詹姆斯的去向' },
  evt_lebron_2014: { title: '2014 年夏天', subtitle: '决定二 · 回归还是留守？' },
  evt_lebron_2017: { title: '2017 年休赛期', subtitle: '欧文的决裂 · 交易还是强留？' },
  evt_lebron_2018: { title: '2018 年夏天', subtitle: '第三次决定 · 紫金还是相信过程？' },
}

export default function ChoiceWheel() {
  const isWheelOpen = useStore((s) => s.isWheelOpen)
  const closeWheel = useStore((s) => s.closeWheel)
  const phase = useStore((s) => s.phase)
  const activeForkId = useStore((s) => s.activeForkId)
  const getFilteredChoices = useStore((s) => s.getFilteredChoices)
  const availableForks = useStore((s) => s.availableForks)
  const refreshAvailableForks = useStore((s) => s.refreshAvailableForks)
  const jamesChoices = useStore((s) => s.jamesChoices)
  const { generate } = useSSE()

  const [selected, setSelected] = useState<string | null>(null)
  const [cachedBranches, setCachedBranches] = useState<string[]>([])

  const forkId = activeForkId ?? 'evt_lebron_2010'
  const choices = getFilteredChoices(forkId)
  const forkMeta = availableForks.find((f) => f.fork_id === forkId)
  const header = FORK_HEADERS[forkId] ?? { title: forkMeta?.title ?? '分叉点', subtitle: forkMeta?.subtitle ?? '' }

  useEffect(() => {
    if (!isWheelOpen) return

    refreshAvailableForks()
      .then(() => fetchUniverseData())
      .then((data) => {
        setCachedBranches(data.cached_branches || [])
        const filtered = useStore.getState().getFilteredChoices(forkId)
        const firstAlt = filtered.find((c: ChoiceData) => !c.is_real_history)
        if (firstAlt) setSelected(firstAlt.choice_id)
      })
      .catch(console.error)
  }, [isWheelOpen, forkId, refreshAvailableForks])

  useEffect(() => {
    if (isWheelOpen) setSelected(null)
  }, [isWheelOpen, forkId])

  useEffect(() => {
    if (choices.length > 0 && !selected) {
      const firstAlt = choices.find((c) => !c.is_real_history)
      if (firstAlt) setSelected(firstAlt.choice_id)
    }
  }, [choices, selected])

  if (!isWheelOpen) return null

  const handlePush = () => {
    if (!selected) return
    const choice = choices.find((c) => c.choice_id === selected)
    if (!choice) return
    closeWheel()
    generate(choice, forkId)
  }

  const selectedChoice = choices.find((c) => c.choice_id === selected)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeWheel()
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: '90vw',
          background: 'rgba(10,10,30,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '24px 20px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#D4A853', margin: 0, fontSize: 18 }}>
            {header.title}
          </h2>
          <p style={{ color: '#94a3b8', margin: '6px 0 0', fontSize: 14 }}>
            {header.subtitle}
          </p>
          {jamesChoices.length > 0 && (
            <p style={{ color: '#64748b', margin: '8px 0 0', fontSize: 10 }}>
              已累积 {jamesChoices.length} 个詹姆斯选择 · 蝴蝶效应传播中
            </p>
          )}
        </div>

        {choices.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>
            当前宇宙状态下此分叉无可用选项
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {choices.map((c) => (
              <ChoiceCard
                key={c.choice_id}
                choice={c}
                isSelected={selected === c.choice_id}
                isCached={cachedBranches.some((k) => k.includes(c.choice_id))}
                onSelect={() => setSelected(c.choice_id)}
              />
            ))}
          </div>
        )}

        <button
          onClick={handlePush}
          disabled={!selected || phase === 'generating' || choices.length === 0}
          style={{
            marginTop: 20,
            width: '100%',
            padding: '14px 0',
            border: 'none',
            borderRadius: 10,
            background: selectedChoice?.team_color ?? '#D4A853',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: !selected || phase === 'generating' ? 'not-allowed' : 'pointer',
            opacity: !selected || phase === 'generating' ? 0.5 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          🔮 推演这个平行世界
        </button>
      </div>
    </div>
  )
}
