import type { TimelineEventPayload, PlayerFateDelta, PlayerCareerEvent, PlayerCareerEventPayload } from '../types'
import { KEY_PLAYERS, playerColor } from '../data/keyPlayers'

const PLAYER_TEAM: Record<string, string> = Object.fromEntries(
  KEY_PLAYERS.map((p) => [p.id, p.teamCode]),
)

const POSITIVE = /冠军|总决赛|签约|加盟|崛起|胜利|MVP|全明星|顶薪/
const NEGATIVE = /连败|横扫|失利|交易|重建|受伤|崩盘|失望|离开/

function sentimentScore(text: string): number {
  const pos = POSITIVE.test(text) ? 1 : 0
  const neg = NEGATIVE.test(text) ? -1 : 0
  return pos + neg
}

export function resolveEventImpacts(
  event: TimelineEventPayload,
): PlayerFateDelta[] {
  if (event.player_impacts?.length) {
    return event.player_impacts
      .map((p) => ({
        playerId: p.player_id.toLowerCase().replace(/\s+/g, '-'),
        legacy: p.legacy ?? 0,
        ringChance: p.ring_chance ?? 0,
        mediaHeat: p.media_heat ?? 0,
        teamFit: p.team_fit ?? 0,
        reason: p.reason || event.title.slice(0, 24),
      }))
      .filter((d) => PLAYER_TEAM[d.playerId])
  }
  return inferPlayerImpacts(event)
}

function mapCareerPayload(
  p: PlayerCareerEventPayload,
  event: TimelineEventPayload,
): PlayerCareerEvent | null {
  const playerId = p.player_id.toLowerCase().replace(/\s+/g, '-')
  if (!PLAYER_TEAM[playerId] || playerId === 'lebron-james') return null
  return {
    id: `ce_${event.event_id}_${playerId}_${p.timestamp}`,
    playerId,
    timestamp: p.timestamp || event.timestamp,
    title: p.title,
    description: p.description,
    vsRealHistory: p.vs_real_history ?? '真实历史线与此不同',
    sourceEventId: event.event_id,
    sourceEventTitle: event.title,
  }
}

export function resolveCareerEvents(
  event: TimelineEventPayload,
): PlayerCareerEvent[] {
  if (event.player_career_events?.length) {
    return event.player_career_events
      .map((p) => mapCareerPayload(p, event))
      .filter((e): e is PlayerCareerEvent => e !== null)
  }
  return inferPlayerImpacts(event)
    .filter((d) => d.playerId !== 'lebron-james')
    .slice(0, 3)
    .map((d) => ({
      id: `ce_${event.event_id}_${d.playerId}_fb`,
      playerId: d.playerId,
      timestamp: event.timestamp,
      title: d.reason.slice(0, 16) || event.title.slice(0, 16),
      description: `因「${event.title}」：${event.description?.slice(0, 100) ?? d.reason}`,
      vsRealHistory: '真实历史线与此不同',
      sourceEventId: event.event_id,
      sourceEventTitle: event.title,
    }))
}

export function inferPlayerImpacts(
  event: TimelineEventPayload,
): PlayerFateDelta[] {
  const text = `${event.title} ${event.description}`
  const sentiment = sentimentScore(text)
  const impacts = new Map<string, PlayerFateDelta>()

  const add = (
    playerId: string,
    deltas: Partial<Omit<PlayerFateDelta, 'playerId' | 'reason'>>,
    reason: string,
    weight = 1,
  ) => {
    const existing = impacts.get(playerId)
    const scale = weight
    const entry: PlayerFateDelta = existing ?? {
      playerId,
      legacy: 0,
      ringChance: 0,
      mediaHeat: 0,
      teamFit: 0,
      reason,
    }
    entry.legacy += (deltas.legacy ?? 0) * scale
    entry.ringChance += (deltas.ringChance ?? 0) * scale
    entry.mediaHeat += (deltas.mediaHeat ?? 0) * scale
    entry.teamFit += (deltas.teamFit ?? 0) * scale
    entry.reason = reason
    impacts.set(playerId, entry)
  }

  // Primary: explicitly named players
  for (const pid of event.key_players ?? []) {
    const norm = pid.toLowerCase().replace(/\s+/g, '-')
    if (!PLAYER_TEAM[norm]) continue
    const base = sentiment >= 0
      ? { legacy: 4, ringChance: 6, mediaHeat: 5, teamFit: 3 }
      : { legacy: -5, ringChance: -8, mediaHeat: -4, teamFit: -6 }
    add(norm, base, event.title.slice(0, 24), 1.2)
  }

  // Secondary: players on affected teams (butterfly ripple)
  for (const team of event.teams_affected ?? []) {
    for (const [pid, teamCode] of Object.entries(PLAYER_TEAM)) {
      if (teamCode !== team) continue
      if (impacts.has(pid)) continue
      const ripple = sentiment >= 0
        ? { legacy: 2, ringChance: 3, mediaHeat: 2, teamFit: 2 }
        : { legacy: -3, ringChance: -4, mediaHeat: -2, teamFit: -3 }
      add(pid, ripple, `波及 ${team}`, 0.6)
    }
  }

  // LeBron always feels branch shocks
  if (!impacts.has('lebron-james')) {
    add(
      'lebron-james',
      sentiment >= 0
        ? { legacy: 2, mediaHeat: 4, ringChance: 2, teamFit: 1 }
        : { legacy: -2, mediaHeat: -3, ringChance: -2, teamFit: -1 },
      '蝴蝶效应中心',
      0.5,
    )
  }

  return [...impacts.values()].filter(
    (d) => d.legacy || d.ringChance || d.mediaHeat || d.teamFit,
  )
}

export function playerColorById(playerId: string): string {
  return playerColor(playerId)
}

export function playerNameZh(playerId: string): string {
  return KEY_PLAYERS.find((p) => p.id === playerId)?.nameZh ?? playerId
}
