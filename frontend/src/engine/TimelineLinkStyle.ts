import type { GraphNode } from '../types'
import type { TimelineNodeMeta } from '../utils/timelineOrder'

export function flowLinkColor(baseHex: string, progress: number, dim = 1): string {
  const age = 1 - progress
  const past = { r: 72, g: 82, b: 98 }
  const end = {
    r: parseInt(baseHex.slice(1, 3), 16),
    g: parseInt(baseHex.slice(3, 5), 16),
    b: parseInt(baseHex.slice(5, 7), 16),
  }
  const t = 0.2 + age * 0.55
  const r = Math.round((past.r + (end.r - past.r) * t) * dim)
  const g = Math.round((past.g + (end.g - past.g) * t) * dim)
  const b = Math.round((past.b + (end.b - past.b) * t) * dim)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function applySoftTimelineLinks(
  fg: {
    linkWidth: (fn: (link: any) => number) => void
    linkColor: (fn: (link: any) => string) => void
    linkOpacity: (n: number) => void
    linkCurvature: (fn: (link: any) => number) => void
    linkDirectionalParticles: (n: number) => void
    linkDirectionalParticleWidth: (n: number) => void
    linkDirectionalParticleSpeed: (n: number) => void
    linkDirectionalParticleColor: (fn: () => string) => void
  },
  nodes: GraphNode[],
  metaMap: Map<string, TimelineNodeMeta>,
  masterBrightness: number,
) {
  fg.linkOpacity(0.35)
  fg.linkCurvature((link: any) => {
    const sourceId = link.source?.id ?? link.source
    const m = metaMap.get(sourceId)
    const order = m?.order ?? 0
    return order % 2 === 0 ? 0.22 : -0.18
  })

  fg.linkWidth((link: any) => {
    const sourceId = link.source?.id ?? link.source
    const m = metaMap.get(sourceId)
    const age = 1 - (m?.progress ?? 0.5)
    return 0.003 + age * 0.005
  })

  fg.linkColor((link: any) => {
    const sourceId = link.source?.id ?? link.source
    const sourceNode = nodes.find((n) => n.id === sourceId)
    const m = metaMap.get(sourceId)
    const base = sourceNode?.color ?? link.color ?? '#D4A853'
    const dim = sourceNode?.isRealHistory ? masterBrightness : 1
    return flowLinkColor(base, m?.progress ?? 0.5, dim)
  })

  fg.linkDirectionalParticles(1)
  fg.linkDirectionalParticleWidth(0.06)
  fg.linkDirectionalParticleSpeed(0.003)
  fg.linkDirectionalParticleColor(() => '#e2e8f0')
}
