// ─── Graph ───

export interface GraphNode {
  id: string
  type: 'fork' | 'event' | 'player'
  label: string
  description?: string
  timestamp: string
  position: { x: number; y: number; z: number }
  color: string
  size: number           // 0.3 – 1.0 sphere radius
  parentId?: string
  isRealHistory: boolean
  isClickable: boolean
  hidden?: boolean
  teamsAffected?: string[]
  ownerPlayerId?: string
  segmentKind?: 'real' | 'parallel'
  /** Where a fork node lives: master spine (initial) or parallel branch tip. */
  forkPlacement?: 'master' | 'parallel'
}

/** Thin career-thread node for NPC constellation timelines. */
export interface NpcTimelineNode {
  id: string
  playerId: string
  label: string
  description?: string
  timestamp: string
  position: { x: number; y: number; z: number }
  color: string
  segmentKind: 'real' | 'parallel'
  hidden?: boolean
  size?: number
  isLatest?: boolean
  isForkAnchor?: boolean
  vsRealHistory?: string
  sourceEventId?: string
}

export interface NpcTimelineEdge {
  id: string
  playerId: string
  source: string
  target: string
  color: string
  segmentKind: 'real' | 'parallel'
  hidden?: boolean
}

export interface NpcCrossLink {
  id: string
  source: string
  target: string
  color: string
  hidden?: boolean
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  color: string
  thickness: number      // 0.02 – 0.08 world units
  isParticleFlow: boolean
  hidden?: boolean
  isRipple?: boolean     // event → player shockwave link
  ephemeral?: boolean
}

// ─── Player constellation (P0 butterfly effect) ───

export interface PlayerStar {
  id: string
  name: string
  nameZh: string
  teamCode: string
  color: string
  rating: number
  position: { x: number; y: number; z: number }
}

export interface PlayerFate {
  legacy: number
  ringChance: number
  mediaHeat: number
  teamFit: number
  totalSwing: number
  lastReason: string
}

export interface PlayerFateDelta {
  playerId: string
  legacy: number
  ringChance: number
  mediaHeat: number
  teamFit: number
  reason: string
}

export interface ButterflyEntry {
  id: string
  playerId: string
  reason: string
  source: 'choice' | 'event'
  eventTitle?: string
  forkId?: string
  forkLabel?: string
  legacy: number
  ringChance: number
  mediaHeat: number
  teamFit: number
  at: number
}

/** Alternate-universe career milestone for a constellation star. */
export interface PlayerCareerEvent {
  id: string
  playerId: string
  timestamp: string
  title: string
  description: string
  vsRealHistory: string
  sourceEventId?: string
  sourceEventTitle?: string
  forkId?: string
}

export interface CareerMilestone {
  timestamp: string
  title: string
  description: string
}

export interface PlayerCareerProfile {
  real_milestones: CareerMilestone[]
  sensitive_to_james_forks: string[]
}

export interface JamesChoiceRecord {
  fork_id: string
  choice_id: string
  choice_label: string
  timestamp: string
}

export interface WorldStateData {
  universe_id: string
  james_choices: JamesChoiceRecord[]
  james_rpg: RPGSixDimensions & { media_favor?: number; fan_reputation?: number; cap_health?: number; physical_toll?: number }
  npc_fates: Record<string, {
    legacy: number
    ring_chance: number
    media_heat: number
    team_fit: number
    total_swing: number
    last_reason: string
  }>
  npc_career_events: Record<string, PlayerCareerEventPayload[]>
  active_branch_events: TimelineEventPayload[]
  current_year: number
  completed_forks: string[]
}

export interface ForkDefinition {
  fork_id: string
  fork_year: number
  title: string
  subtitle: string
  description: string
  timestamp: string
  is_completed: boolean
  choices: ChoiceData[]
  simulation_window: { start_year: number; end_year: number }
}

export interface MasterTimelineData {
  forks: Array<{ fork_id: string; insert_after_event_id: string | null }>
  events: TimelineEventPayload[]
}

export interface UniverseAPIResponse {
  world_state: WorldStateData
  available_forks: ForkDefinition[]
  fork_order: string[]
  master_timeline: MasterTimelineData
  career_milestones: Record<string, PlayerCareerProfile>
  cached_branches: string[]
}

export interface PlayerCareerEventPayload {
  player_id: string
  timestamp: string
  title: string
  description: string
  vs_real_history?: string
}

// ─── RPG Stats ───

export interface RPGSixDimensions {
  championships: number   // 0-7
  legacy: number          // 0-100
  mediaFavor: number      // 0-100
  fanReputation: number   // 0-100
  capHealth: number       // 0-100
  physicalToll: number    // 0-100, higher = worse
}

export interface StatDelta {
  dimension: keyof RPGSixDimensions
  delta: number
  reason: string
}

// ─── Social ───

export type Sentiment = 'angry' | 'excited' | 'sarcastic' | 'shocked' | 'hate'

export interface SocialPost {
  id: string
  username: string
  handle: string
  avatarColor: string
  content: string
  sentiment: Sentiment
  timestamp: number
}

// ─── SSE Event Payloads ───

export interface TimelineEventPayload {
  event_id: string
  timestamp: string
  title: string
  description: string
  teams_affected: string[]
  key_players: string[]
  confidence: number
  player_impacts?: PlayerImpactPayload[]
  player_career_events?: PlayerCareerEventPayload[]
}

export interface PlayerImpactPayload {
  player_id: string
  legacy?: number
  ring_chance?: number
  media_heat?: number
  team_fit?: number
  reason: string
}

export interface StatUpdatePayload {
  dimension: string
  delta: number
  reason: string
}

export interface SocialPostPayload {
  username: string
  handle: string
  avatar_color: string
  content: string
  sentiment: string
}

// ─── API Response ───

export interface EventNodeData {
  id: string
  label: string
  timestamp?: string
  color?: string
  description?: string
  isFork?: boolean
  isDimmed?: boolean
  isReal?: boolean
  isGenerated?: boolean
  confidence?: number
  onClick?: () => void
}

export interface GeneratedEvent {
  event_id: string
  timestamp: string
  title: string
  description: string
  teams_affected: string[]
  key_players: string[]
  confidence: number
}

export interface TimelineAPIResponse {
  decision_event: DecisionEventData
  real_history: RealHistoryData
  cached_branches: string[]
}

export interface DecisionEventData {
  event_id: string
  timestamp: string
  type: string
  title: string
  subtitle: string
  description: string
  actor: Record<string, unknown>
  choices: ChoiceData[]
  context: Record<string, unknown>
}

export interface ChoiceData {
  choice_id: string
  label: string
  team_code: string
  team_color: string
  is_real_history: boolean
  pitch: string
  roster_before: string[]
  cap_space: number
}

export interface RealHistoryData {
  branch_id: string
  branch_name: string
  color: string
  parent_event_id: string
  parent_choice_id: string
  events: TimelineEventPayload[]
}

export interface NarrativeEvent {
  id: string
  timestamp: string
  title: string
  description: string
  teamColor: string
  isBranch: boolean
  teamsAffected?: string[]
}
