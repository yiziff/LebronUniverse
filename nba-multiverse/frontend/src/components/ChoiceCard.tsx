import type { ChoiceData } from '../types'

interface Props {
  choice: ChoiceData
  isSelected: boolean
  isCached: boolean
  onSelect: () => void
}

export default function ChoiceCard({ choice, isSelected, isCached, onSelect }: Props) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 8,
        border: isSelected
          ? `2px solid ${choice.team_color}`
          : '1px solid rgba(255,255,255,0.1)',
        background: isSelected
          ? `${choice.team_color}22`
          : 'rgba(255,255,255,0.04)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {/* Team color bar */}
      <div
        style={{
          width: 4,
          height: 36,
          borderRadius: 2,
          background: choice.team_color,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
          {choice.label}
          {choice.is_real_history && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: '#D4A853',
                background: 'rgba(212,168,83,0.15)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              真实历史
            </span>
          )}
          {isCached && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                color: '#60a5fa',
                background: 'rgba(96,165,250,0.15)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              已推演
            </span>
          )}
        </div>
        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
          {choice.pitch}
        </div>
      </div>

      {/* Radio indicator */}
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `2px solid ${isSelected ? choice.team_color : 'rgba(255,255,255,0.3)'}`,
          background: isSelected ? choice.team_color : 'transparent',
          flexShrink: 0,
        }}
      />
    </div>
  )
}
