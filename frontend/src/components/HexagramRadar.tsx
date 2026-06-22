import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import type { RPGSixDimensions, StatDelta } from '../types'
import { UI_WIDTH } from '../styles/uiTypography'
import gsap from 'gsap'

const DIMENSIONS: { key: keyof RPGSixDimensions; label: string; icon: string }[] = [
  { key: 'championships', label: '总冠军', icon: '🏆' },
  { key: 'legacy', label: '历史地位', icon: '👑' },
  { key: 'mediaFavor', label: '媒体好感', icon: '📺' },
  { key: 'fanReputation', label: '球迷口碑', icon: '❤️' },
  { key: 'capHealth', label: '薪资健康', icon: '💰' },
  { key: 'physicalToll', label: '体能透支', icon: '⚡' },
]

const CENTER = 120
const MAX_R = 90
const ANGLE_OFFSET = -Math.PI / 2

function getVertex(axisIndex: number, value: number): [number, number] {
  const angle = ANGLE_OFFSET + (axisIndex * Math.PI * 2) / 6
  const r = (value / 100) * MAX_R
  return [CENTER + Math.cos(angle) * r, CENTER + Math.sin(angle) * r]
}

function vertexColor(value: number): string {
  if (value > 70) return '#4ade80'
  if (value > 40) return '#facc15'
  return '#ef4444'
}

function DeltaBadge({ delta, axisIndex }: { delta: StatDelta; axisIndex: number }) {
  const [x, y] = getVertex(axisIndex, 118)
  const isPositive = delta.delta > 0
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      fill={isPositive ? '#4ade80' : '#ef4444'}
      fontSize={11}
      fontWeight={700}
      style={{ animation: 'fadeBadge 1.5s ease-out forwards' }}
    >
      {isPositive ? '+' : ''}{delta.delta}
    </text>
  )
}

export default function HexagramRadar() {
  const rpgStats = useStore((s) => s.rpgStats)
  const recentStatBadges = useStore((s) => s.recentStatBadges)
  const clearStatBadges = useStore((s) => s.clearStatBadges)
  const polygonRef = useRef<SVGPolygonElement>(null)
  const prevValues = useRef<number[]>(DIMENSIONS.map((d) => rpgStats[d.key]))
  const badgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const newValues = DIMENSIONS.map((d) => rpgStats[d.key])
    const obj: Record<string, number> = {}
    DIMENSIONS.forEach((d, i) => {
      obj[d.key] = prevValues.current[i]
      prevValues.current[i] = newValues[i]
    })

    gsap.to(obj, {
      ...Object.fromEntries(
        DIMENSIONS.map((d) => [d.key, rpgStats[d.key]]),
      ),
      duration: 0.6,
      ease: 'elastic.out(1, 0.3)',
      onUpdate: () => {
        if (!polygonRef.current) return
        const pts = DIMENSIONS.map((d) => {
          const v = obj[d.key]
          const idx = DIMENSIONS.findIndex((x) => x.key === d.key)
          return getVertex(idx, v).join(',')
        }).join(' ')
        polygonRef.current.setAttribute('points', pts)
      },
    })
  }, [rpgStats])

  // Auto-hide delta badges after 1.5s
  useEffect(() => {
    if (recentStatBadges.length === 0) return
    if (badgeTimer.current) clearTimeout(badgeTimer.current)
    badgeTimer.current = setTimeout(() => clearStatBadges(), 1500)
    return () => {
      if (badgeTimer.current) clearTimeout(badgeTimer.current)
    }
  }, [recentStatBadges, clearStatBadges])

  const currentPoints = DIMENSIONS.map((d, i) =>
    getVertex(i, rpgStats[d.key]).join(','),
  ).join(' ')

  // Show only the latest badge per dimension
  const latestBadges = recentStatBadges.reduce<StatDelta[]>((acc, d) => {
    const idx = acc.findIndex((x) => x.dimension === d.dimension)
    if (idx >= 0) acc[idx] = d
    else acc.push(d)
    return acc
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 12,
        zIndex: 10,
        background: 'rgba(10,10,30,0.82)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: 8,
        width: UI_WIDTH.radarPanel,
      }}
    >
      <svg viewBox="0 0 240 240" width="100%" height={176}>
        {[0.25, 0.5, 0.75, 1.0].map((scale) => {
          const bgPts = DIMENSIONS.map((_, i) => {
            const [x, y] = getVertex(i, 100 * scale)
            return `${x},${y}`
          }).join(' ')
          return (
            <polygon
              key={scale}
              points={bgPts}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          )
        })}

        {DIMENSIONS.map((_, i) => {
          const [ex, ey] = getVertex(i, 100)
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={ex}
              y2={ey}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
            />
          )
        })}

        <polygon
          ref={polygonRef}
          points={currentPoints}
          fill="rgba(212,168,83,0.2)"
          stroke="#D4A853"
          strokeWidth={2}
        />

        {DIMENSIONS.map((d, i) => {
          const [x, y] = getVertex(i, rpgStats[d.key])
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={4}
              fill={vertexColor(rpgStats[d.key])}
              stroke="#fff"
              strokeWidth={1}
            />
          )
        })}

        {latestBadges.map((d) => {
          const axisIndex = DIMENSIONS.findIndex((dim) => dim.key === d.dimension)
          if (axisIndex < 0) return null
          return <DeltaBadge key={d.dimension} delta={d} axisIndex={axisIndex} />
        })}

        {DIMENSIONS.map((d, i) => {
          const [x, y] = getVertex(i, 110)
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#cbd5e1"
              fontSize={9}
            >
              {d.icon}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
