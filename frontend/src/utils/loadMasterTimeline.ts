import type {
  GraphNode, GraphEdge, UniverseAPIResponse,
  MasterTimelineData, ForkDefinition, DecisionEventData,
} from '../types'
import { primeBackendMode } from './apiClient'
import { resolveCareerMilestones } from '../data/careerMilestones'

export const FORK_ORDER = [
  'evt_lebron_2010',
  'evt_lebron_2014',
  'evt_lebron_2017',
  'evt_lebron_2018',
] as const

export type ForkId = (typeof FORK_ORDER)[number]

export function nextForkId(forkId: string): string | null {
  const idx = FORK_ORDER.indexOf(forkId as ForkId)
  if (idx === -1 || idx >= FORK_ORDER.length - 1) return null
  return FORK_ORDER[idx + 1]
}

export function isForkClickable(forkId: string, completedForks: string[]): boolean {
  const idx = FORK_ORDER.indexOf(forkId as ForkId)
  if (idx === -1) return false
  if (completedForks.includes(forkId)) return false
  if (idx === 0) return true
  return completedForks.includes(FORK_ORDER[idx - 1])
}

/** Compute horizontal center of the James timeline for camera / constellation. */
export function timelineCenterX(master: MasterTimelineData): number {
  const forkCount = master.forks.length
  const eventCount = master.events.length
  return ((eventCount + forkCount - 1) * 1.5) / 2
}

function forkFromDecision(decision: DecisionEventData): ForkDefinition {
  return {
    fork_id: decision.event_id,
    fork_year: (decision as DecisionEventData & { fork_year?: number }).fork_year ?? 2010,
    title: decision.title,
    subtitle: decision.subtitle,
    description: decision.description,
    timestamp: decision.timestamp,
    is_completed: false,
    choices: decision.choices,
    simulation_window: { start_year: 2010, end_year: 2014 },
  }
}

/** Try /api/universe; fall back to /api/timeline so the graph always loads. */
export async function fetchUniverseData(): Promise<UniverseAPIResponse> {
  try {
    const res = await fetch('/api/universe')
    if (res.ok) {
      primeBackendMode('full')
      return (await res.json()) as UniverseAPIResponse
    }
    primeBackendMode('legacy')
  } catch (err) {
    console.warn('[timeline] /api/universe unreachable', err)
    primeBackendMode('legacy')
  }

  const res = await fetch('/api/timeline')
  if (!res.ok) throw new Error(`Failed to load timeline: ${res.status}`)
  const legacy = await res.json()

  const master: MasterTimelineData = legacy.master_timeline ?? {
    forks: [{ fork_id: legacy.decision_event.event_id, insert_after_event_id: null }],
    events: legacy.real_history.events,
  }

  return {
    world_state: {
      universe_id: '',
      james_choices: [],
      james_rpg: {
        championships: 0,
        legacy: 50,
        mediaFavor: 50,
        fanReputation: 50,
        capHealth: 50,
        physicalToll: 0,
      },
      npc_fates: {},
      npc_career_events: {},
      active_branch_events: [],
      current_year: 2010,
      completed_forks: [],
    },
    available_forks: legacy.available_forks ?? [forkFromDecision(legacy.decision_event)],
    fork_order: [...FORK_ORDER],
    master_timeline: master,
    career_milestones: resolveCareerMilestones(legacy.career_milestones),
    cached_branches: legacy.cached_branches ?? [],
  }
}

export function buildTimelineGraph(
  data: UniverseAPIResponse,
  completedForks: string[],
  addNode: (n: GraphNode) => void,
  addEdge: (e: GraphEdge) => void,
): number {
  const { master_timeline } = data
  const forkColor = '#D4A853'
  const masterColor = '#D4A853'

  let x = 0
  let prevId: string | null = null

  const firstForkId = master_timeline.forks[0]?.fork_id ?? 'evt_lebron_2010'
  const firstForkMeta = data.available_forks.find((f) => f.fork_id === firstForkId)

  const forkNode0: GraphNode = {
    id: firstForkId,
    type: 'fork',
    label: firstForkMeta?.title ?? 'The Decision',
    description: firstForkMeta?.description ?? '',
    timestamp: firstForkMeta?.timestamp ?? '2010-07-08',
    position: { x, y: 1.2, z: 0 },
    color: forkColor,
    size: 0.85,
    isRealHistory: true,
    isClickable: isForkClickable(firstForkId, completedForks),
    forkPlacement: 'master',
  }
  addNode(forkNode0)
  prevId = forkNode0.id

  master_timeline.events.forEach((evt, idx) => {
    x = (idx + 1) * 1.5
    const node: GraphNode = {
      id: evt.event_id,
      type: 'event',
      label: evt.title,
      description: evt.description,
      timestamp: evt.timestamp,
      teamsAffected: evt.teams_affected,
      position: { x, y: 1.2, z: 0 },
      color: masterColor,
      size: 0.5,
      isRealHistory: true,
      isClickable: false,
    }
    addNode(node)

    if (prevId) {
      addEdge({
        id: `edge_${prevId}_${evt.event_id}`,
        source: prevId,
        target: evt.event_id,
        color: masterColor,
        thickness: 0.03,
        isParticleFlow: true,
      })
    }
    prevId = evt.event_id
  })

  return timelineCenterX(master_timeline)
}
