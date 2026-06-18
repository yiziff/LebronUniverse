import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useSSE } from '../hooks/useSSE'
import ChoiceCard from './ChoiceCard'
import type { ChoiceData } from '../types'
import { fetchUniverseData } from '../utils/loadMasterTimeline'
import { hashCustomChoiceId, validateCustomText } from '../utils/apiClient'
import { UI } from '../styles/uiTypography'

const FORK_HEADERS: Record<string, { title: string; subtitle: string }> = {
  evt_lebron_2010: { title: '2010 年夏天', subtitle: '决定一 · 勒布朗·詹姆斯的去向' },
  evt_lebron_2014: { title: '2014 年夏天', subtitle: '决定二 · 回归还是留守？' },
  evt_lebron_2017: { title: '2017 年休赛期', subtitle: '欧文的决裂 · 交易还是强留？' },
  evt_lebron_2018: { title: '2018 年夏天', subtitle: '第三次决定 · 紫金还是相信过程？' },
}

type PickMode = 'preset' | 'custom'

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

  const [pickMode, setPickMode] = useState<PickMode>('preset')
  const [selected, setSelected] = useState<string | null>(null)
  const [customText, setCustomText] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)
  const [cachedBranches, setCachedBranches] = useState<string[]>([])

  const forkId = activeForkId ?? 'evt_lebron_2010'
  const choices = getFilteredChoices(forkId)
  const forkMeta = availableForks.find((f) => f.fork_id === forkId)
  const header = FORK_HEADERS[forkId] ?? { title: forkMeta?.title ?? '分叉点', subtitle: forkMeta?.subtitle ?? '' }
  const allowsCustom = forkMeta?.allows_custom !== false

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
    if (isWheelOpen) {
      setSelected(null)
      setCustomText('')
      setCustomError(null)
      setPickMode(choices.length > 0 ? 'preset' : 'custom')
    }
  }, [isWheelOpen, forkId, choices.length])

  useEffect(() => {
    if (choices.length > 0 && !selected && pickMode === 'preset') {
      const firstAlt = choices.find((c) => !c.is_real_history)
      if (firstAlt) setSelected(firstAlt.choice_id)
    }
  }, [choices, selected, pickMode])

  if (!isWheelOpen) return null

  const canSubmitPreset = pickMode === 'preset' && selected && choices.length > 0
  const canSubmitCustom = pickMode === 'custom' && customText.trim().length > 0
  const canSubmit = (canSubmitPreset || canSubmitCustom) && phase !== 'generating'

  const handlePush = async () => {
    if (!canSubmit) return

    if (pickMode === 'custom') {
      const err = validateCustomText(customText)
      if (err) {
        setCustomError(err)
        return
      }
      setCustomError(null)
      const choiceId = await hashCustomChoiceId(customText)
      const choice: ChoiceData = {
        choice_id: choiceId,
        label: customText.trim().slice(0, 80),
        team_code: 'CUSTOM',
        team_color: '#D4A853',
        is_real_history: false,
        pitch: customText.trim(),
        roster_before: [],
        cap_space: 0,
      }
      closeWheel()
      generate(choice, forkId, customText.trim())
      return
    }

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
          width: 440,
          maxWidth: '92vw',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'rgba(10,10,30,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '24px 20px',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h2 style={{ color: '#D4A853', margin: 0, fontSize: 18 }}>
            {header.title}
          </h2>
          <p style={{ color: '#94a3b8', margin: '6px 0 0', fontSize: 14 }}>
            {header.subtitle}
          </p>
          {jamesChoices.length > 0 && (
            <p style={{ color: '#64748b', margin: '8px 0 0', fontSize: UI.caption }}>
              已累积 {jamesChoices.length} 个詹姆斯选择 · 蝴蝶效应传播中
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {choices.length > 0 && (
            <button
              type="button"
              onClick={() => setPickMode('preset')}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 8,
                border: pickMode === 'preset' ? '1px solid #D4A853' : '1px solid rgba(255,255,255,0.1)',
                background: pickMode === 'preset' ? 'rgba(212,168,83,0.15)' : 'transparent',
                color: pickMode === 'preset' ? '#D4A853' : '#94a3b8',
                cursor: 'pointer',
                fontSize: UI.bodySmall,
                fontWeight: 600,
              }}
            >
              预设选项
            </button>
          )}
          {allowsCustom && (
            <button
              type="button"
              onClick={() => setPickMode('custom')}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 8,
                border: pickMode === 'custom' ? '1px solid #D4A853' : '1px solid rgba(255,255,255,0.1)',
                background: pickMode === 'custom' ? 'rgba(212,168,83,0.15)' : 'transparent',
                color: pickMode === 'custom' ? '#D4A853' : '#94a3b8',
                cursor: 'pointer',
                fontSize: UI.bodySmall,
                fontWeight: 600,
              }}
            >
              自定义决定
            </button>
          )}
        </div>

        {pickMode === 'preset' && choices.length > 0 && (
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

        {pickMode === 'preset' && choices.length === 0 && (
          <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: UI.bodySmall, margin: '0 0 12px' }}>
            当前宇宙状态下无预设选项，请使用自定义决定
          </p>
        )}

        {pickMode === 'custom' && (
          <div>
            <textarea
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value.slice(0, 200))
                setCustomError(null)
              }}
              placeholder="描述詹姆斯的决定，例如：加盟金州勇士与库里组队 / 留守骑士不交易欧文 / 2018年继续效力克利夫兰"
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: 10,
                border: `1px solid ${customError ? '#ef4444' : 'rgba(255,255,255,0.12)'}`,
                background: 'rgba(0,0,0,0.35)',
                color: '#e2e8f0',
                fontSize: UI.body,
                lineHeight: UI.lineHeight,
                resize: 'vertical',
                minHeight: 96,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ color: '#64748b', fontSize: UI.caption }}>
                AI 将据此推演平行宇宙（最多 200 字）
              </span>
              <span style={{ color: '#64748b', fontSize: UI.caption }}>
                {customText.length}/200
              </span>
            </div>
            {customError && (
              <p style={{ color: '#f87171', fontSize: UI.bodySmall, margin: '8px 0 0' }}>
                {customError}
              </p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handlePush}
          disabled={!canSubmit}
          style={{
            marginTop: 20,
            width: '100%',
            padding: '14px 0',
            border: 'none',
            borderRadius: 10,
            background: (pickMode === 'custom' ? '#D4A853' : selectedChoice?.team_color) ?? '#D4A853',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            cursor: !canSubmit ? 'not-allowed' : 'pointer',
            opacity: !canSubmit ? 0.5 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {pickMode === 'custom' ? '🔮 推演我的平行世界' : '🔮 推演这个平行世界'}
        </button>
      </div>
    </div>
  )
}
