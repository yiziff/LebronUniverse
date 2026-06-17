import { create } from 'zustand'
import type {
  GraphNode, GraphEdge, RPGSixDimensions, StatDelta,
  SocialPost, ChoiceData, NarrativeEvent,
  PlayerStar, PlayerFate, PlayerFateDelta, ButterflyEntry, PlayerCareerEvent,
  JamesChoiceRecord, WorldStateData, ForkDefinition, PlayerCareerProfile,
  NpcTimelineNode, NpcTimelineEdge, NpcCrossLink,
} from '../types'
import {
  KEY_PLAYERS, spreadConstellationPositions, playerColor,
} from '../data/keyPlayers'
import { resolveCareerMilestones } from '../data/careerMilestones'
import { syncUniverseIfAvailable } from '../utils/apiClient'
import { fetchUniverseData } from '../utils/loadMasterTimeline'
import {
  buildAllRealLanes, buildParallelNodeAtPosition, connectParallelToChain,
  forkAnchorForPlayer, isSensitiveToFork, milestoneYear,
  playerBranchBasis, resolveParallelPositionWithSpacing,
  parseForkYear,
} from '../utils/playerTimelineLayout'

type AppPhase = 'idle' | 'choosing' | 'generating' | 'complete'

const BASE_FATE = (): PlayerFate => ({
  legacy: 50,
  ringChance: 50,
  mediaHeat: 50,
  teamFit: 50,
  totalSwing: 0,
  lastReason: '',
})

function buildInitialFates(): Record<string, PlayerFate> {
  const fates: Record<string, PlayerFate> = {}
  for (const p of KEY_PLAYERS) fates[p.id] = BASE_FATE()
  return fates
}

function buildInitialStars(): PlayerStar[] {
  const spread = spreadConstellationPositions(KEY_PLAYERS)
  return KEY_PLAYERS.map((p) => ({
    id: p.id,
    name: p.name,
    nameZh: p.nameZh,
    teamCode: p.teamCode,
    color: playerColor(p.id),
    rating: p.rating,
    position: spread.get(p.id)!,
  }))
}

const FORK_LABELS: Record<string, string> = {
  evt_lebron_2010: '2010 决定一',
  evt_lebron_2014: '2014 决定二',
  evt_lebron_2017: '2017 欧文危机',
  evt_lebron_2018: '2018 第三次决定',
}

interface GenerationSnapshot {
  nodes: GraphNode[]
  edges: GraphEdge[]
  masterBrightness: number
  rpgStats: RPGSixDimensions
  playerFates: Record<string, PlayerFate>
  playerCareerEvents: Record<string, PlayerCareerEvent[]>
  jamesChoices: JamesChoiceRecord[]
  completedForks: string[]
  npcTimelineNodes: NpcTimelineNode[]
  npcTimelineEdges: NpcTimelineEdge[]
  npcCrossLinks: NpcCrossLink[]
  npcBranchSteps: Record<string, number>
  npcForkAnchors: Record<string, { x: number; y: number; z: number }>
}

const INITIAL_RPG: RPGSixDimensions = {
  championships: 0,
  legacy: 50,
  mediaFavor: 50,
  fanReputation: 50,
  capHealth: 50,
  physicalToll: 0,
}

export interface AppStore {
  nodes: GraphNode[]
  edges: GraphEdge[]
  masterBrightness: number
  activeBranchId: string | null

  addNode: (node: GraphNode) => void
  addEdge: (edge: GraphEdge) => void
  setMasterBrightness: (b: number) => void
  resetGraph: () => void
  hideMasterTailAfterFork: (forkId?: string) => void

  playerStars: PlayerStar[]
  playerFates: Record<string, PlayerFate>
  pulsingPlayerIds: string[]
  selectedPlayerId: string | null

  initPlayerConstellation: () => void
  applyPlayerImpacts: (
    deltas: PlayerFateDelta[],
    meta?: { source?: 'choice' | 'event'; eventTitle?: string; forkId?: string; forkLabel?: string },
  ) => void
  addRippleEdges: (eventId: string, playerIds: string[], color: string) => void
  setPulsingPlayers: (ids: string[]) => void
  setSelectedPlayerId: (id: string | null) => void
  resetPlayerFates: () => void

  playerCareerEvents: Record<string, PlayerCareerEvent[]>
  pushPlayerCareerEvents: (events: Omit<PlayerCareerEvent, 'id'>[]) => void
  clearPlayerCareerEvents: () => void

  npcTimelineNodes: NpcTimelineNode[]
  npcTimelineEdges: NpcTimelineEdge[]
  npcCrossLinks: NpcCrossLink[]
  npcBranchSteps: Record<string, number>
  npcForkAnchors: Record<string, { x: number; y: number; z: number }>
  selectedNpcNodeId: string | null
  rebuildNpcTimelines: () => void
  appendSingleNpcParallel: (event: PlayerCareerEvent) => void
  appendNpcParallelFromImpact: (
    playerId: string,
    event: Omit<PlayerCareerEvent, 'id'>,
    jamesNodeId: string,
    forkId: string,
  ) => string | null
  prepareNpcBranchForFork: (forkId: string) => void
  markNpcParallelLatest: () => void
  dissolveNpcTimelinesForFork: (forkId: string) => Array<{ x: number; y: number; z: number }>
  addNpcCrossLink: (source: string, target: string, color: string) => void
  selectNpcTimelineNode: (nodeId: string) => void

  butterflyEntries: ButterflyEntry[]
  activeChoiceLabel: string
  activeForkId: string | null
  clearButterfly: () => void
  setActiveChoiceLabel: (label: string) => void
  setActiveForkId: (id: string | null) => void

  universeId: string
  jamesChoices: JamesChoiceRecord[]
  currentYear: number
  completedForks: string[]
  availableForks: ForkDefinition[]
  careerMilestones: Record<string, PlayerCareerProfile>

  initUniverse: (data: {
    world_state: WorldStateData
    available_forks: ForkDefinition[]
    career_milestones: Record<string, PlayerCareerProfile>
  }) => void
  refreshAvailableForks: () => Promise<void>
  recordJamesChoice: (record: JamesChoiceRecord) => void
  markForkCompleted: (forkId: string) => void
  syncWorldStateToBackend: () => Promise<void>
  resetUniverse: () => Promise<void>
  getFilteredChoices: (forkId: string) => ChoiceData[]
  getForkLabel: (forkId: string) => string

  rpgStats: RPGSixDimensions
  statHistory: StatDelta[]
  recentStatBadges: StatDelta[]

  applyStatDelta: (d: StatDelta) => void
  clearStatBadges: () => void

  posts: SocialPost[]
  pushPost: (p: SocialPost) => void

  narrativeEvents: NarrativeEvent[]
  featuredEventId: string | null
  selectedNodeId: string | null
  activeTeamColor: string

  pushNarrative: (e: NarrativeEvent) => void
  setFeaturedEvent: (id: string) => void
  setSelectedNodeId: (id: string | null) => void
  setActiveTeamColor: (c: string) => void
  clearNarrative: () => void

  phase: AppPhase
  isWheelOpen: boolean
  inputLocked: boolean
  statusText: string
  statusSubtext: string
  generationSnapshot: GenerationSnapshot | null
  choices: ChoiceData[]

  setPhase: (p: AppPhase) => void
  setActiveBranchId: (id: string | null) => void
  openWheel: (forkId?: string) => void
  closeWheel: () => void
  setInputLocked: (locked: boolean) => void
  setStatusText: (t: string, sub?: string) => void
  setChoices: (c: ChoiceData[]) => void
  takeSnapshot: () => void
  triggerRollback: () => void
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export const useStore = create<AppStore>((set, get) => ({
  nodes: [],
  edges: [],
  masterBrightness: 1.0,
  activeBranchId: null,

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),
  setMasterBrightness: (b) => set({ masterBrightness: b }),
  resetGraph: () => set({ nodes: [], edges: [], masterBrightness: 1.0, activeBranchId: null }),

  hideMasterTailAfterFork: (forkId?: string) =>
    set((s) => {
      const forkIdx = forkId
        ? s.nodes.findIndex((n) => n.id === forkId)
        : s.nodes.findIndex((n) => n.type === 'fork')
      if (forkIdx === -1) return {}
      const hiddenIds = new Set(
        s.nodes.filter((n, i) => n.isRealHistory && i > forkIdx).map((n) => n.id),
      )
      return {
        nodes: s.nodes.map((n) => (hiddenIds.has(n.id) ? { ...n, hidden: true } : n)),
        edges: s.edges.map((e) =>
          hiddenIds.has(e.source) || hiddenIds.has(e.target)
            ? { ...e, hidden: true }
            : e,
        ),
      }
    }),

  playerStars: buildInitialStars(),
  playerFates: buildInitialFates(),
  pulsingPlayerIds: [],
  selectedPlayerId: null,

  initPlayerConstellation: () =>
    set({
      playerStars: buildInitialStars(),
      playerFates: buildInitialFates(),
      pulsingPlayerIds: [],
      selectedPlayerId: null,
    }),

  applyPlayerImpacts: (deltas, meta) =>
    set((s) => {
      const forkId = meta?.forkId ?? s.activeForkId ?? undefined
      const forkLabel = meta?.forkLabel ?? (forkId ? FORK_LABELS[forkId] : undefined)
      const fates = { ...s.playerFates }
      const pulsing: string[] = []
      const entries = [...s.butterflyEntries]
      for (const d of deltas) {
        const cur = fates[d.playerId] ?? BASE_FATE()
        const swing =
          Math.abs(d.legacy) + Math.abs(d.ringChance) +
          Math.abs(d.mediaHeat) + Math.abs(d.teamFit)
        fates[d.playerId] = {
          legacy: clamp(cur.legacy + d.legacy, 0, 100),
          ringChance: clamp(cur.ringChance + d.ringChance, 0, 100),
          mediaHeat: clamp(cur.mediaHeat + d.mediaHeat, 0, 100),
          teamFit: clamp(cur.teamFit + d.teamFit, 0, 100),
          totalSwing: cur.totalSwing + swing,
          lastReason: d.reason,
        }
        pulsing.push(d.playerId)
        entries.push({
          id: `bf_${Date.now()}_${d.playerId}_${Math.random().toString(36).slice(2, 6)}`,
          playerId: d.playerId,
          reason: d.reason,
          source: meta?.source ?? 'event',
          eventTitle: meta?.eventTitle,
          forkId,
          forkLabel,
          legacy: d.legacy,
          ringChance: d.ringChance,
          mediaHeat: d.mediaHeat,
          teamFit: d.teamFit,
          at: Date.now(),
        })
      }
      return {
        playerFates: fates,
        pulsingPlayerIds: pulsing,
        butterflyEntries: entries.slice(-48),
      }
    }),

  butterflyEntries: [],
  activeChoiceLabel: '',
  activeForkId: null,
  clearButterfly: () => set({ butterflyEntries: [] }),
  setActiveChoiceLabel: (label) => set({ activeChoiceLabel: label }),
  setActiveForkId: (id) => set({ activeForkId: id }),

  universeId: '',
  jamesChoices: [],
  currentYear: 2010,
  completedForks: [],
  availableForks: [],
  careerMilestones: {},

  initUniverse: (data) => {
    const ws = data.world_state
    const s = get()
    if (!ws) return

    if (!ws.universe_id) {
      set({
        availableForks: data.available_forks?.length ? data.available_forks : s.availableForks,
        careerMilestones: resolveCareerMilestones(
          Object.keys(data.career_milestones ?? {}).length
            ? data.career_milestones
            : s.careerMilestones,
        ),
      })
      if (data.career_milestones && Object.keys(data.career_milestones).length > 0) {
        get().rebuildNpcTimelines()
      }
      return
    }

    const fates = buildInitialFates()
    for (const [pid, nf] of Object.entries(ws.npc_fates ?? {})) {
      if (fates[pid]) {
        fates[pid] = {
          legacy: nf.legacy,
          ringChance: nf.ring_chance,
          mediaHeat: nf.media_heat,
          teamFit: nf.team_fit,
          totalSwing: nf.total_swing,
          lastReason: nf.last_reason,
        }
      }
    }
    const careerMap: Record<string, PlayerCareerEvent[]> = {}
    for (const [pid, evs] of Object.entries(ws.npc_career_events ?? {})) {
      careerMap[pid] = evs.map((e, i) => ({
        id: `ce_init_${pid}_${i}`,
        playerId: e.player_id,
        timestamp: e.timestamp,
        title: e.title,
        description: e.description,
        vsRealHistory: e.vs_real_history ?? '',
      }))
    }
    set({
      universeId: ws.universe_id,
      jamesChoices: ws.james_choices ?? [],
      currentYear: ws.current_year ?? 2010,
      completedForks: ws.completed_forks ?? [],
      availableForks: data.available_forks,
      careerMilestones: resolveCareerMilestones(data.career_milestones),
      playerFates: fates,
      playerCareerEvents: careerMap,
      rpgStats: {
        championships: ws.james_rpg?.championships ?? 0,
        legacy: ws.james_rpg?.legacy ?? 50,
        mediaFavor: ws.james_rpg?.media_favor ?? ws.james_rpg?.mediaFavor ?? 50,
        fanReputation: ws.james_rpg?.fan_reputation ?? ws.james_rpg?.fanReputation ?? 50,
        capHealth: ws.james_rpg?.cap_health ?? ws.james_rpg?.capHealth ?? 50,
        physicalToll: ws.james_rpg?.physical_toll ?? ws.james_rpg?.physicalToll ?? 0,
      },
    })
    if (data.career_milestones && Object.keys(data.career_milestones).length > 0) {
      get().rebuildNpcTimelines()
    }
  },

  refreshAvailableForks: async () => {
    try {
      const data = await fetchUniverseData()
      const s = get()
      const mergedCompleted = [
        ...new Set([
          ...(data.world_state?.completed_forks ?? []),
          ...s.completedForks,
        ]),
      ]
      set({
        availableForks: data.available_forks?.length ? data.available_forks : s.availableForks,
        completedForks: mergedCompleted,
        careerMilestones: resolveCareerMilestones(
          Object.keys(data.career_milestones ?? {}).length
            ? data.career_milestones
            : s.careerMilestones,
        ),
        ...(data.world_state?.universe_id && !s.universeId
          ? { universeId: data.world_state.universe_id }
          : {}),
      })
    } catch (err) {
      console.warn('[universe] refreshAvailableForks failed', err)
    }
  },

  recordJamesChoice: (record) =>
    set((s) => ({
      jamesChoices: [...s.jamesChoices.filter((c) => c.fork_id !== record.fork_id), record],
    })),

  markForkCompleted: (forkId) =>
    set((s) => ({
      completedForks: s.completedForks.includes(forkId)
        ? s.completedForks
        : [...s.completedForks, forkId],
    })),

  syncWorldStateToBackend: async () => {
    const s = get()
    const payload = {
      universe_id: s.universeId,
      james_choices: s.jamesChoices,
      james_rpg: {
        championships: s.rpgStats.championships,
        legacy: s.rpgStats.legacy,
        media_favor: s.rpgStats.mediaFavor,
        fan_reputation: s.rpgStats.fanReputation,
        cap_health: s.rpgStats.capHealth,
        physical_toll: s.rpgStats.physicalToll,
      },
      npc_fates: Object.fromEntries(
        Object.entries(s.playerFates)
          .filter(([id]) => id !== 'lebron-james')
          .map(([id, f]) => [id, {
            legacy: f.legacy,
            ring_chance: f.ringChance,
            media_heat: f.mediaHeat,
            team_fit: f.teamFit,
            total_swing: f.totalSwing,
            last_reason: f.lastReason,
          }]),
      ),
      npc_career_events: Object.fromEntries(
        Object.entries(s.playerCareerEvents).map(([pid, evs]) => [
          pid,
          evs.map((e) => ({
            player_id: e.playerId,
            timestamp: e.timestamp,
            title: e.title,
            description: e.description,
            vs_real_history: e.vsRealHistory,
          })),
        ]),
      ),
      active_branch_events: [],
      current_year: s.currentYear,
      completed_forks: s.completedForks,
    }
    await syncUniverseIfAvailable(payload)
  },

  resetUniverse: async () => {
    const res = await fetch('/api/universe/reset', { method: 'POST' })
    const data = await res.json()
    get().initUniverse({
      world_state: data.world_state,
      available_forks: get().availableForks,
      career_milestones: get().careerMilestones,
    })
    set({
      nodes: [],
      edges: [],
      masterBrightness: 1.0,
      playerFates: buildInitialFates(),
      playerCareerEvents: {},
      butterflyEntries: [],
      jamesChoices: [],
      completedForks: [],
      currentYear: 2010,
      phase: 'idle',
      narrativeEvents: [],
      posts: [],
    })
  },

  getFilteredChoices: (forkId) => {
    const fork = get().availableForks.find((f) => f.fork_id === forkId)
    return fork?.choices ?? []
  },

  getForkLabel: (forkId) => FORK_LABELS[forkId] ?? forkId,

  addRippleEdges: (eventId, playerIds, color) =>
    set((s) => {
      const newEdges = playerIds.map((pid) => ({
        id: `ripple_${eventId}_${pid}`,
        source: eventId,
        target: pid,
        color,
        thickness: 0.02,
        isParticleFlow: false,
        isRipple: true,
        ephemeral: true,
      }))
      const withoutOld = s.edges.filter((e) => !e.ephemeral)
      return { edges: [...withoutOld, ...newEdges] }
    }),

  setPulsingPlayers: (ids) => set({ pulsingPlayerIds: ids }),
  setSelectedPlayerId: (id) => set({ selectedPlayerId: id, selectedNpcNodeId: null }),

  resetPlayerFates: () =>
    set({ playerFates: buildInitialFates(), pulsingPlayerIds: [], playerCareerEvents: {} }),

  playerCareerEvents: {},

  npcTimelineNodes: [],
  npcTimelineEdges: [],
  npcCrossLinks: [],
  npcBranchSteps: {},
  npcForkAnchors: {},
  selectedNpcNodeId: null,

  rebuildNpcTimelines: () => {
    const s = get()
    const milestones = resolveCareerMilestones(s.careerMilestones)
    if (Object.keys(milestones).length > 0 && Object.keys(s.careerMilestones).length === 0) {
      set({ careerMilestones: milestones })
    }
    const stars = s.playerStars.length > 0 ? s.playerStars : buildInitialStars()
    if (stars !== s.playerStars) {
      set({ playerStars: stars })
    }
    const { nodes, edges } = buildAllRealLanes(milestones, stars)
    const branchSteps: Record<string, number> = {}
    const forkAnchors: Record<string, { x: number; y: number; z: number }> = {}
    set({
      npcTimelineNodes: nodes,
      npcTimelineEdges: edges,
      npcCrossLinks: [],
      npcBranchSteps: branchSteps,
      npcForkAnchors: forkAnchors,
    })

    const eventsByPlayer = new Map<string, PlayerCareerEvent[]>()
    for (const evs of Object.values(get().playerCareerEvents)) {
      for (const ev of evs) {
        const list = eventsByPlayer.get(ev.playerId) ?? []
        list.push(ev)
        eventsByPlayer.set(ev.playerId, list)
      }
    }
    for (const [, evs] of eventsByPlayer) {
      const sorted = [...evs].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      for (const ev of sorted) {
        get().appendSingleNpcParallel(ev)
      }
    }
  },

  prepareNpcBranchForFork: (forkId) => {
    const s = get()
    const forkYear = parseForkYear(forkId)
    const branchSteps = { ...s.npcBranchSteps }
    const forkAnchors = { ...s.npcForkAnchors }
    for (const star of s.playerStars) {
      if (star.id === 'lebron-james') continue
      const profile = s.careerMilestones[star.id]
      if (!isSensitiveToFork(profile, forkYear)) continue
      branchSteps[star.id] = 0
      forkAnchors[star.id] = forkAnchorForPlayer(
        star.id, forkId, s.npcTimelineNodes, s.careerMilestones, s.playerStars,
      )
    }
    set({ npcBranchSteps: branchSteps, npcForkAnchors: forkAnchors })
  },

  appendSingleNpcParallel: (event: PlayerCareerEvent) => {
    const s = get()
    const npcStars = s.playerStars.filter((p) => p.id !== 'lebron-james')
    const idx = npcStars.findIndex((p) => p.id === event.playerId)
    if (idx === -1) return
    const star = npcStars[idx]
    const eventKey = event.id.replace(/[^a-z0-9]/gi, '_')
    const nodeId = `npc_${event.playerId}_${eventKey}_par`
    if (s.npcTimelineNodes.some((n) => n.id === nodeId)) return

    const forkId = event.forkId ?? s.activeForkId ?? 'evt_lebron_2010'
    const step = (s.npcBranchSteps[event.playerId] ?? 0) + 1
    let anchor = s.npcForkAnchors[event.playerId]
    if (!anchor) {
      anchor = forkAnchorForPlayer(
        event.playerId, forkId, s.npcTimelineNodes, s.careerMilestones, s.playerStars,
      )
    }
    const basis = playerBranchBasis(star, idx)
    const pos = resolveParallelPositionWithSpacing(
      basis, anchor, step, s.npcTimelineNodes, event.playerId,
    )
    const node = buildParallelNodeAtPosition(
      event, pos, star.color, eventKey, false,
    )
    const newEdges = connectParallelToChain(
      s.npcTimelineNodes, s.npcTimelineEdges, node, event.playerId, anchor,
    )
    set({
      npcTimelineNodes: [...s.npcTimelineNodes, node],
      npcTimelineEdges: [...s.npcTimelineEdges, ...newEdges],
      npcBranchSteps: { ...s.npcBranchSteps, [event.playerId]: step },
      npcForkAnchors: { ...s.npcForkAnchors, [event.playerId]: anchor },
    })
    if (event.sourceEventId) {
      get().addNpcCrossLink(event.sourceEventId, node.id, star.color)
    }
  },

  appendNpcParallelFromImpact: (playerId, careerEvent, jamesNodeId, forkId) => {
    const s = get()
    const npcStars = s.playerStars.filter((p) => p.id !== 'lebron-james')
    const idx = npcStars.findIndex((p) => p.id === playerId)
    if (idx === -1) return null
    const star = npcStars[idx]

    const id = `ce_${Date.now()}_${playerId}_${Math.random().toString(36).slice(2, 5)}`
    const event: PlayerCareerEvent = {
      ...careerEvent,
      id,
      playerId,
      forkId,
      sourceEventId: jamesNodeId,
    }
    const eventKey = id.replace(/[^a-z0-9]/gi, '_')
    const nodeId = `npc_${playerId}_${eventKey}_par`
    if (s.npcTimelineNodes.some((n) => n.id === nodeId)) return null

    const step = (s.npcBranchSteps[playerId] ?? 0) + 1
    let anchor = s.npcForkAnchors[playerId]
    if (!anchor) {
      anchor = forkAnchorForPlayer(
        playerId, forkId, s.npcTimelineNodes, s.careerMilestones, s.playerStars,
      )
    }
    const basis = playerBranchBasis(star, idx)
    const pos = resolveParallelPositionWithSpacing(
      basis, anchor, step, s.npcTimelineNodes, playerId,
    )
    const node = buildParallelNodeAtPosition(event, pos, star.color, eventKey, false)
    const newEdges = connectParallelToChain(
      s.npcTimelineNodes, s.npcTimelineEdges, node, playerId, anchor,
    )

    const map = { ...s.playerCareerEvents }
    const list = [...(map[playerId] ?? []), event]
    list.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    map[playerId] = list

    set({
      npcTimelineNodes: [...s.npcTimelineNodes, node],
      npcTimelineEdges: [...s.npcTimelineEdges, ...newEdges],
      npcBranchSteps: { ...s.npcBranchSteps, [playerId]: step },
      npcForkAnchors: { ...s.npcForkAnchors, [playerId]: anchor },
      playerCareerEvents: map,
    })
    get().addNpcCrossLink(jamesNodeId, node.id, star.color)
    return node.id
  },

  markNpcParallelLatest: () =>
    set((s) => {
      const latestByPlayer = new Map<string, string>()
      for (const n of s.npcTimelineNodes) {
        if (n.hidden || n.segmentKind !== 'parallel') continue
        const prev = latestByPlayer.get(n.playerId)
        if (!prev || n.timestamp >= (s.npcTimelineNodes.find((x) => x.id === prev)?.timestamp ?? '')) {
          latestByPlayer.set(n.playerId, n.id)
        }
      }
      const fateIds = new Set(
        Object.entries(s.playerFates)
          .filter(([id, f]) => id !== 'lebron-james' && f.totalSwing > 0)
          .map(([id]) => id),
      )
      return {
        npcTimelineNodes: s.npcTimelineNodes.map((n) => ({
          ...n,
          isLatest: latestByPlayer.get(n.playerId) === n.id && fateIds.has(n.playerId),
        })),
      }
    }),

  selectNpcTimelineNode: (nodeId) => {
    const node = get().npcTimelineNodes.find((n) => n.id === nodeId)
    if (!node) return
    set({
      selectedPlayerId: node.playerId,
      selectedNpcNodeId: nodeId,
      phase: get().phase === 'idle' ? 'complete' : get().phase,
    })
    const star = get().playerStars.find((p) => p.id === node.playerId)
    get().setStatusText(
      `${star?.nameZh ?? node.playerId} · ${node.label}`,
      node.vsRealHistory ? `vs 真实历史：${node.vsRealHistory}` : '平行宇宙生涯节点（只读）',
    )
  },

  dissolveNpcTimelinesForFork: (forkId) => {
    const forkYear = parseForkYear(forkId)
    const s = get()
    const dissolved: Array<{ x: number; y: number; z: number }> = []

    const nodes = s.npcTimelineNodes.map((n) => {
      const profile = s.careerMilestones[n.playerId]
      if (!isSensitiveToFork(profile, forkYear)) return n
      const shouldHide =
        n.segmentKind === 'parallel' ||
        (n.segmentKind === 'real' && milestoneYear(n.timestamp) > forkYear)
      if (shouldHide && !n.hidden) dissolved.push({ ...n.position })
      return shouldHide ? { ...n, hidden: true } : n
    })

    const hiddenIds = new Set(nodes.filter((n) => n.hidden).map((n) => n.id))
    const edges = s.npcTimelineEdges.map((e) =>
      hiddenIds.has(e.source) || hiddenIds.has(e.target)
        ? { ...e, hidden: true }
        : e,
    )

    const branchSteps = { ...s.npcBranchSteps }
    const forkAnchors = { ...s.npcForkAnchors }
    for (const star of s.playerStars) {
      if (star.id === 'lebron-james') continue
      const profile = s.careerMilestones[star.id]
      if (!isSensitiveToFork(profile, forkYear)) continue
      branchSteps[star.id] = 0
      delete forkAnchors[star.id]
    }

    set({ npcTimelineNodes: nodes, npcTimelineEdges: edges, npcBranchSteps: branchSteps, npcForkAnchors: forkAnchors })
    return dissolved
  },

  addNpcCrossLink: (source, target, color) =>
    set((s) => ({
      npcCrossLinks: [
        ...s.npcCrossLinks,
        { id: `xlink_${source}_${target}_${Date.now()}`, source, target, color },
      ],
    })),

  pushPlayerCareerEvents: (events) => {
    const appended: PlayerCareerEvent[] = []
    set((s) => {
      const map = { ...s.playerCareerEvents }
      for (const e of events) {
        const id = `ce_${Date.now()}_${e.playerId}_${Math.random().toString(36).slice(2, 5)}`
        const entry: PlayerCareerEvent = { ...e, id }
        const list = [...(map[e.playerId] ?? []), entry]
        list.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        map[e.playerId] = list
        appended.push(entry)
      }
      return { playerCareerEvents: map }
    })
    for (const ev of appended) {
      get().appendSingleNpcParallel(ev)
    }
  },

  clearPlayerCareerEvents: () => set({ playerCareerEvents: {} }),

  rpgStats: { ...INITIAL_RPG },
  statHistory: [],
  recentStatBadges: [],

  applyStatDelta: (d) =>
    set((s) => {
      const key = d.dimension
      const val = s.rpgStats[key] ?? 0
      const hi = key === 'championships' ? 7 : 100
      return {
        rpgStats: { ...s.rpgStats, [key]: clamp(val + d.delta, 0, hi) },
        statHistory: [...s.statHistory, d],
        recentStatBadges: [...s.recentStatBadges, d],
      }
    }),
  clearStatBadges: () => set({ recentStatBadges: [] }),

  posts: [],
  pushPost: (p) => set((s) => ({ posts: [...s.posts, p] })),

  narrativeEvents: [],
  featuredEventId: null,
  selectedNodeId: null,
  activeTeamColor: '#D4A853',

  pushNarrative: (e) =>
    set((s) => ({
      narrativeEvents: [...s.narrativeEvents, e],
      featuredEventId: e.id,
      selectedNodeId: e.id,
    })),
  setFeaturedEvent: (id) => set({ featuredEventId: id, selectedNodeId: id }),
  setSelectedNodeId: (id) => {
    if (!id) {
      set({ selectedNodeId: null })
      return
    }
    const node = get().nodes.find((n) => n.id === id)
    const existing = get().narrativeEvents.find((n) => n.id === id)
    if (node && !existing) {
      set((s) => ({
        selectedNodeId: id,
        featuredEventId: id,
        narrativeEvents: [
          ...s.narrativeEvents,
          {
            id: node.id,
            timestamp: node.timestamp,
            title: node.label,
            description: node.description ?? '暂无详细描述',
            teamColor: node.color,
            isBranch: !!node.parentId,
            teamsAffected: node.teamsAffected,
          },
        ],
      }))
    } else {
      set({ selectedNodeId: id, featuredEventId: id })
    }
  },
  setActiveTeamColor: (c) => set({ activeTeamColor: c }),
  clearNarrative: () =>
    set({ narrativeEvents: [], featuredEventId: null, selectedNodeId: null }),

  phase: 'idle',
  isWheelOpen: false,
  inputLocked: false,
  statusText: '点击脉动的金色节点，改变 NBA 历史',
  statusSubtext: '同色故事线 = 同一球星 · 较暗真实 · 较亮平行',
  generationSnapshot: null,
  choices: [],

  setPhase: (p) => set({ phase: p }),
  setActiveBranchId: (id) => set({ activeBranchId: id }),
  openWheel: (forkId?: string) =>
    set({
      isWheelOpen: true,
      phase: 'choosing',
      activeForkId: forkId ?? get().activeForkId ?? 'evt_lebron_2010',
    }),
  closeWheel: () => set({ isWheelOpen: false, phase: 'idle' }),
  setInputLocked: (locked) => set({ inputLocked: locked }),
  setStatusText: (t, sub = '') => set({ statusText: t, statusSubtext: sub }),
  setChoices: (c) => set({ choices: c }),

  takeSnapshot: () => {
    const {
      nodes, edges, masterBrightness, rpgStats, playerFates,
      playerCareerEvents, jamesChoices, completedForks,
      npcTimelineNodes, npcTimelineEdges, npcCrossLinks,
      npcBranchSteps, npcForkAnchors,
    } = get()
    set({
      generationSnapshot: {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        masterBrightness,
        rpgStats: { ...rpgStats },
        playerFates: JSON.parse(JSON.stringify(playerFates)),
        playerCareerEvents: JSON.parse(JSON.stringify(playerCareerEvents)),
        jamesChoices: JSON.parse(JSON.stringify(jamesChoices)),
        completedForks: [...completedForks],
        npcTimelineNodes: JSON.parse(JSON.stringify(npcTimelineNodes)),
        npcTimelineEdges: JSON.parse(JSON.stringify(npcTimelineEdges)),
        npcCrossLinks: JSON.parse(JSON.stringify(npcCrossLinks)),
        npcBranchSteps: { ...npcBranchSteps },
        npcForkAnchors: { ...npcForkAnchors },
      },
    })
  },

  triggerRollback: () => {
    const snap = get().generationSnapshot
    if (!snap) return
    set({
      nodes: snap.nodes,
      edges: snap.edges.filter((e) => !e.ephemeral),
      masterBrightness: snap.masterBrightness,
      rpgStats: { ...snap.rpgStats },
      playerFates: JSON.parse(JSON.stringify(snap.playerFates)),
      playerCareerEvents: JSON.parse(JSON.stringify(snap.playerCareerEvents ?? {})),
      jamesChoices: JSON.parse(JSON.stringify(snap.jamesChoices ?? [])),
      completedForks: [...(snap.completedForks ?? [])],
      npcTimelineNodes: JSON.parse(JSON.stringify(snap.npcTimelineNodes ?? [])),
      npcTimelineEdges: JSON.parse(JSON.stringify(snap.npcTimelineEdges ?? [])),
      npcCrossLinks: JSON.parse(JSON.stringify(snap.npcCrossLinks ?? [])),
      npcBranchSteps: { ...(snap.npcBranchSteps ?? {}) },
      npcForkAnchors: { ...(snap.npcForkAnchors ?? {}) },
      pulsingPlayerIds: [],
      statHistory: [],
      recentStatBadges: [],
      posts: [],
      narrativeEvents: [],
      featuredEventId: null,
      selectedNodeId: null,
      selectedPlayerId: null,
      phase: 'idle',
      inputLocked: false,
      statusText: '⚠️ 时间线崩塌 · 点击重试',
      statusSubtext: '点击分叉点重试',
      activeBranchId: null,
      butterflyEntries: [],
      activeChoiceLabel: '',
    })
  },
}))
