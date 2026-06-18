import { useStore } from '../store'
import { useSSE } from '../hooks/useSSE'
import { UI } from '../styles/uiTypography'

export default function StatusBar() {
  const statusText = useStore((s) => s.statusText)
  const statusSubtext = useStore((s) => s.statusSubtext)
  const phase = useStore((s) => s.phase)
  const activeTeamColor = useStore((s) => s.activeTeamColor)
  const { cancel } = useSSE()

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        maxWidth: '90vw',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(10,10,30,0.9)',
          border: `1px solid ${phase === 'generating' ? activeTeamColor + '55' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 20,
          padding: '8px 20px',
          boxShadow: phase === 'generating' ? `0 0 24px ${activeTeamColor}22` : 'none',
        }}
      >
        {phase === 'generating' && (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: activeTeamColor,
              animation: 'pulse 1s infinite',
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            color: '#f1f5f9',
            fontSize: UI.bodyLarge,
            fontWeight: phase === 'generating' ? 600 : 400,
            maxWidth: 480,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {statusText}
        </span>
        {phase === 'generating' && (
          <button
            onClick={cancel}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: 'none',
              color: '#94a3b8',
              fontSize: UI.bodySmall,
              padding: '4px 10px',
              borderRadius: 10,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ✕ 取消
          </button>
        )}
      </div>
      {statusSubtext && (
        <span style={{ color: '#64748b', fontSize: UI.bodySmall }}>{statusSubtext}</span>
      )}
    </div>
  )
}
