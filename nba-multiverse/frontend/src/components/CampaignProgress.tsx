import { useStore } from '../store'
import { isForkClickable } from '../utils/loadMasterTimeline'
import { UI } from '../styles/uiTypography'

const FORK_STEPS = [
  { id: 'evt_lebron_2010', short: '2010 决定一' },
  { id: 'evt_lebron_2014', short: '2014 决定二' },
  { id: 'evt_lebron_2017', short: '2017 欧文' },
  { id: 'evt_lebron_2018', short: '2018 决定三' },
]

export default function CampaignProgress() {
  const completedForks = useStore((s) => s.completedForks)
  const highlightedForkId = useStore((s) => s.highlightedForkId)
  const phase = useStore((s) => s.phase)
  const openWheel = useStore((s) => s.openWheel)
  const getForkLabel = useStore((s) => s.getForkLabel)

  const done = completedForks.length
  const nextClickable = highlightedForkId && isForkClickable(highlightedForkId, completedForks)

  const handleStepClick = (stepId: string, isNext: boolean) => {
    if (phase === 'generating') return
    if (!isForkClickable(stepId, completedForks)) return
    if (isNext || stepId === highlightedForkId) {
      openWheel(stepId)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(6,6,20,0.88)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: '8px 14px',
          maxWidth: '94vw',
          overflowX: 'auto',
        }}
      >
        <span style={{ color: '#64748b', fontSize: UI.caption, marginRight: 4, flexShrink: 0 }}>
          生涯抉择 {done}/4
        </span>
        {FORK_STEPS.map((step, i) => {
          const isDone = completedForks.includes(step.id)
          const isNext = highlightedForkId === step.id
          const clickable = isForkClickable(step.id, completedForks) && phase !== 'generating'
          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && (
                <span style={{ color: '#334155', fontSize: UI.caption }}>→</span>
              )}
              <button
                type="button"
                onClick={() => handleStepClick(step.id, isNext)}
                disabled={!clickable}
                title={
                  clickable
                    ? `点击进行：${getForkLabel(step.id)}`
                    : isDone
                      ? '已完成'
                      : getForkLabel(step.id)
                }
                style={{
                  fontSize: UI.caption,
                  fontWeight: isNext ? 700 : 500,
                  color: isDone ? '#4ade80' : isNext ? '#fbbf24' : '#64748b',
                  whiteSpace: 'nowrap',
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: isNext ? 'rgba(251,191,36,0.12)' : 'transparent',
                  border: isNext ? '1px solid rgba(251,191,36,0.4)' : '1px solid transparent',
                  boxShadow: isNext ? '0 0 12px rgba(251,191,36,0.25)' : undefined,
                  cursor: clickable ? 'pointer' : 'default',
                  opacity: clickable || isDone ? 1 : 0.55,
                }}
              >
                {isDone ? '✓ ' : isNext ? '● ' : ''}{step.short}
              </button>
            </div>
          )
        })}
      </div>
      {nextClickable && phase !== 'generating' && (
        <button
          type="button"
          onClick={() => openWheel(highlightedForkId!)}
          style={{
            background: 'rgba(251,191,36,0.15)',
            border: '1px solid rgba(251,191,36,0.45)',
            color: '#fbbf24',
            fontSize: UI.caption,
            padding: '4px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          点击继续 · {getForkLabel(highlightedForkId!)}
        </button>
      )}
    </div>
  )
}
