import type {
  ButterflyEntry,
  ForkDefinition,
  GraphEdge,
  GraphNode,
  JamesChoiceRecord,
  NarrativeEvent,
  TimelineEventPayload,
} from '../types'
import { playerColor } from '../data/keyPlayers'
import {
  loadBranchFromCache,
  type CachedBranch,
} from '../hooks/useBranchCache'
import { loadButterflyEntries, saveButterflyEntries } from './butterflyPersist'
import { computeChoiceRipple } from './choiceButterfly'
import { FORK_ORDER, nextForkId } from './loadMasterTimeline'
import { computeParallelEventPosition } from './parallelForkLayout'
import { resolveEventImpacts } from './inferPlayerImpact'
import { useStore } from '../store'

const FORK_LABELS: Record<string, string> = {
  evt_lebron_2010: '2010 决定一',
  evt_lebron_2014: '2014 决定二',
  evt_lebron_2017: '2017 欧文危机',
  evt_lebron_2018: '2018 第三次决定',
}

async function fetchBranchFromBackend(choiceId: string): Promise<CachedBranch | null> {
  try {
    const res = await fetch(`/api/branch/${choiceId}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.status === 'not_generated' || !Array.isArray(data.events) || data.events.length === 0) {
      return null
    }
    return {
      forkId: data.parent_event_id,
      choiceId: data.parent_choice_id ?? choiceId,
      events: data.events,
      statUpdates: (data.stat_changes ?? []).map((sc: { dimension: string; delta: number; reason: string }) => ({
        dimension: sc.dimension,
        delta: sc.delta,
        reason: sc.reason,
      })),
      socialPosts: data.social_posts ?? [],
      savedAt: Date.now(),
    }
  } catch {
    return null
  }
}

async function resolveBranch(forkId: string, choiceId: string): Promise<CachedBranch | null> {
  return loadBranchFromCache(forkId, choiceId) ?? fetchBranchFromBackend(choiceId)
}

function forkLabel(forkId: string): string {
  return FORK_LABELS[forkId] ?? forkId
}

function sortChoicesByFork(choices: JamesChoiceRecord[]): JamesChoiceRecord[] {
  return [...choices].sort(
    (a, b) =>
      FORK_ORDER.indexOf(a.fork_id as (typeof FORK_ORDER)[number]) -
      FORK_ORDER.indexOf(b.fork_id as (typeof FORK_ORDER)[number]),
  )
}

function pushImpactEntry(
  entries: ButterflyEntry[],
  forkId: string,
  playerId: string,
  delta: {
    legacy: number
    ringChance: number
    mediaHeat: number
    teamFit: number
    reason: string
  },
  meta: { source: 'choice' | 'event'; eventTitle?: string; suffix: string },
): void {
  if (playerId === 'lebron-james') return
  const swing =
    Math.abs(delta.legacy) + Math.abs(delta.ringChance) +
    Math.abs(delta.mediaHeat) + Math.abs(delta.teamFit)
  if (swing === 0) return

  entries.push({
    id: `bf_${forkId}_${playerId}_${meta.suffix}`,
    playerId,
    reason: delta.reason,
    source: meta.source,
    eventTitle: meta.eventTitle,
    forkId,
    forkLabel: forkLabel(forkId),
    legacy: delta.legacy,
    ringChance: delta.ringChance,
    mediaHeat: delta.mediaHeat,
    teamFit: delta.teamFit,
    at: Date.now(),
  })
}

/** Rebuild butterfly panel entries from James choices + cached branch events. */
async function rebuildButterflyFromSession(
  jamesChoices: JamesChoiceRecord[],
  availableForks: ForkDefinition[],
): Promise<ButterflyEntry[]> {
  const entries: ButterflyEntry[] = []
  const sorted = sortChoicesByFork(jamesChoices)

  for (const choice of sorted) {
    const forkDef = availableForks.find((f) => f.fork_id === choice.fork_id)
    const choiceDef = forkDef?.choices.find((c) => c.choice_id === choice.choice_id)
    if (!choiceDef || choiceDef.is_real_history) continue

    for (const impact of computeChoiceRipple(choice.fork_id, choiceDef)) {
      pushImpactEntry(entries, choice.fork_id, impact.playerId, impact, {
        source: 'choice',
        eventTitle: choiceDef.label,
        suffix: `choice_${choice.choice_id}`,
      })
    }

    const branch = await resolveBranch(choice.fork_id, choice.choice_id)
    if (!branch?.events.length) continue

    branch.events.forEach((raw, idx) => {
      const event = raw as TimelineEventPayload
      for (const impact of resolveEventImpacts(event)) {
        pushImpactEntry(entries, choice.fork_id, impact.playerId, impact, {
          source: 'event',
          eventTitle: event.title,
          suffix: `evt_${event.event_id}_${idx}`,
        })
      }
    })
  }

  return entries.slice(-48)
}

/** Restore butterfly entries: localStorage first, then deterministic rebuild. */
export async function restoreButterflyPanel(): Promise<ButterflyEntry[]> {
  const { universeId, jamesChoices, completedForks, availableForks } = useStore.getState()

  if (jamesChoices.length === 0 && completedForks.length === 0) {
    return []
  }

  const persisted = loadButterflyEntries(universeId)
  if (persisted.length > 0) {
    return persisted
  }

  return rebuildButterflyFromSession(jamesChoices, availableForks)
}

/** Replay cached branch events onto the James graph (no stat / NPC side-effects). */
function replayBranchGraph(branch: CachedBranch): void {
  const { forkId, choiceId, events } = branch
  const state = useStore.getState()
  const forkNode = state.nodes.find((n) => n.id === forkId)
  if (!forkNode || events.length === 0) return

  const anchor = {
    x: forkNode.position.x,
    y: forkNode.position.y,
    z: forkNode.position.z,
  }
  const branchColor = playerColor('lebron-james')
  const newNodes: GraphNode[] = [...state.nodes]
  const newEdges: GraphEdge[] = [...state.edges]
  const narratives: NarrativeEvent[] = [...state.narrativeEvents]

  let lastNodeId: string | null = forkNode.id

  events.forEach((raw, idx) => {
    const data = raw as TimelineEventPayload
    const step = idx + 1
    const pos = computeParallelEventPosition(anchor, step)
    const nodeId = data.event_id

    if (newNodes.some((n) => n.id === nodeId)) {
      lastNodeId = nodeId
      return
    }

    newNodes.push({
      id: nodeId,
      type: 'event',
      label: data.title,
      description: data.description,
      timestamp: data.timestamp,
      position: { x: pos.x, y: pos.y, z: pos.z },
      color: branchColor,
      size: (data.confidence ?? 0.7) > 0.8 ? 0.75 : 0.52,
      parentId: choiceId,
      isRealHistory: false,
      isClickable: false,
      teamsAffected: data.teams_affected,
    })

    if (lastNodeId) {
      newEdges.push({
        id: `edge_${lastNodeId}_${nodeId}`,
        source: lastNodeId,
        target: nodeId,
        color: branchColor,
        thickness: 0.04,
        isParticleFlow: true,
      })
    }

    narratives.push({
      id: nodeId,
      timestamp: data.timestamp,
      title: data.title,
      description: data.description || '平行宇宙事件',
      teamColor: branchColor,
      isBranch: true,
      teamsAffected: data.teams_affected,
    })

    lastNodeId = nodeId
  })

  useStore.setState({ nodes: newNodes, edges: newEdges, narrativeEvents: narratives })
}

function applyPostSessionUi(restoredGraph: boolean): void {
  const { jamesChoices, completedForks } = useStore.getState()
  if (completedForks.length === 0 && jamesChoices.length === 0) return

  const lastFork = completedForks[completedForks.length - 1] ?? jamesChoices[jamesChoices.length - 1]?.fork_id
  const lastChoice = jamesChoices.find((c) => c.fork_id === lastFork) ?? jamesChoices[jamesChoices.length - 1]
  const nextId = lastFork ? nextForkId(lastFork) : null

  useStore.setState({
    phase: 'complete',
    masterBrightness: 0.92,
    activeChoiceLabel: lastChoice?.choice_label ?? '',
    statusText: restoredGraph ? '平行宇宙已恢复 · 继续探索' : useStore.getState().statusText,
    statusSubtext: nextId
      ? `点击平行宇宙末端分叉点 · ${forkLabel(nextId)}`
      : '全部分叉推演完成 · 点击球星查看命运',
  })
}

/**
 * After master timeline is built, restore parallel James branches from
 * localStorage cache or backend branch cache, then reconcile fork visibility.
 */
export async function rehydrateParallelBranches(): Promise<boolean> {
  const state = useStore.getState()
  const { jamesChoices, completedForks, availableForks } = state

  let restored = false
  const sorted = sortChoicesByFork(jamesChoices)

  for (const choice of sorted) {
    const forkDef = availableForks.find((f) => f.fork_id === choice.fork_id)
    const choiceDef = forkDef?.choices.find((c) => c.choice_id === choice.choice_id)
    if (choiceDef?.is_real_history) continue

    const branch = await resolveBranch(choice.fork_id, choice.choice_id)
    if (!branch?.events.length) continue

    replayBranchGraph(branch)
    restored = true

    if (completedForks.includes(choice.fork_id)) {
      useStore.getState().hideMasterTailAfterFork(choice.fork_id)
      useStore.getState().hideResolvedMasterForks(choice.fork_id)
      useStore.getState().spawnNextParallelFork(choice.fork_id)
    }
  }

  useStore.getState().reconcileParallelForks()

  const butterflyEntries = await restoreButterflyPanel()
  if (butterflyEntries.length > 0) {
    useStore.setState({ butterflyEntries })
    saveButterflyEntries(useStore.getState().universeId, butterflyEntries)
  }

  if (completedForks.length > 0 || jamesChoices.length > 0) {
    applyPostSessionUi(restored)
  }

  return restored
}
