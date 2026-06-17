/** Shared camera / constellation anchor — updated when timeline loads. */
export let NEBULA_CENTER = { x: 11, y: 3.2, z: 0 }

export function setNebulaCenter(x: number, y = 3.2, z = 0) {
  NEBULA_CENTER = { x, y, z }
}

export const TEAM_COLORS: Record<string, string> = {
  CLE: '#860038',
  MIA: '#98002E',
  NYK: '#F58426',
  CHI: '#CE1141',
  TOR: '#CE1141',
  LAL: '#552583',
  OKC: '#007AC1',
  DAL: '#00538C',
  DEN: '#0E2240',
  ORL: '#0077C0',
  NOH: '#0C2340',
  IND: '#002D62',
  GSW: '#1D428A',
  SAC: '#5A2D81',
  WAS: '#002B5C',
  UTA: '#002B5C',
}

/** Active NPC roster — butterfly effect story lines (excluding LeBron). */
export const ACTIVE_NPC_IDS = [
  'dwyane-wade',
  'kevin-durant',
  'paul-george',
  'stephen-curry',
] as const

export type ActiveNpcId = (typeof ACTIVE_NPC_IDS)[number]

export const KEY_PLAYER_IDS = [
  'lebron-james',
  ...ACTIVE_NPC_IDS,
] as const

export type KeyPlayerId = (typeof KEY_PLAYER_IDS)[number]

/** One distinct color per star — used for stars, nodes, and story-line tubes. */
export const PLAYER_COLORS: Record<KeyPlayerId, string> = {
  'lebron-james': '#D4A853',
  'dwyane-wade': '#FF4D6D',
  'kevin-durant': '#38BDF8',
  'paul-george': '#FB923C',
  'stephen-curry': '#818CF8',
}

export function playerColor(playerId: string): string {
  return PLAYER_COLORS[playerId as KeyPlayerId] ?? '#94a3b8'
}

/** Real-history segments use the same hue, slightly muted. */
export function playerRealColor(playerId: string): string {
  const base = playerColor(playerId)
  const r = parseInt(base.slice(1, 3), 16)
  const g = parseInt(base.slice(3, 5), 16)
  const b = parseInt(base.slice(5, 7), 16)
  const mix = (c: number) => Math.round(c * 0.72 + 72 * 0.28)
  return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`
}

export interface KeyPlayerDef {
  id: KeyPlayerId
  name: string
  nameZh: string
  teamCode: string
  rating: number
}

export const KEY_PLAYERS: KeyPlayerDef[] = [
  { id: 'lebron-james', name: 'LeBron James', nameZh: '勒布朗', teamCode: 'CLE', rating: 98 },
  { id: 'dwyane-wade', name: 'Dwyane Wade', nameZh: '韦德', teamCode: 'MIA', rating: 95 },
  { id: 'kevin-durant', name: 'Kevin Durant', nameZh: '杜兰特', teamCode: 'OKC', rating: 92 },
  { id: 'paul-george', name: 'Paul George', nameZh: '乔治', teamCode: 'IND', rating: 72 },
  { id: 'stephen-curry', name: 'Stephen Curry', nameZh: '库里', teamCode: 'GSW', rating: 80 },
]

const MIN_STAR_SEP = 2.2

/** Place stars on a ring above the James timeline. */
export function constellationPosition(
  player: KeyPlayerDef,
  index: number,
  total: number,
): { x: number; y: number; z: number } {
  const t = index / total
  const angle = t * Math.PI * 2 - Math.PI * 0.55
  const ratingNorm = player.rating / 100
  const radius = 5.2 + ratingNorm * 2.4
  const yLift = 2.4 + ratingNorm * 2.6 + (index % 2) * 0.4

  return {
    x: NEBULA_CENTER.x + radius * Math.cos(angle),
    y: NEBULA_CENTER.y + yLift,
    z: NEBULA_CENTER.z + radius * Math.sin(angle) * 0.45,
  }
}

export function spreadConstellationPositions(
  players: KeyPlayerDef[],
): Map<string, { x: number; y: number; z: number }> {
  const positions = new Map<string, { x: number; y: number; z: number }>()
  players.forEach((p, i) => {
    positions.set(p.id, constellationPosition(p, i, players.length))
  })

  for (let pass = 0; pass < 10; pass++) {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = positions.get(players[i].id)!
        const b = positions.get(players[j].id)!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dz = b.z - a.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (dist >= MIN_STAR_SEP || dist < 0.001) continue
        const push = (MIN_STAR_SEP - dist) * 0.6
        const nx = dx / dist
        const ny = dy / dist
        const nz = dz / dist
        a.x -= nx * push
        a.y -= ny * push
        a.z -= nz * push
        b.x += nx * push
        b.y += ny * push
        b.z += nz * push
      }
    }
  }
  return positions
}
