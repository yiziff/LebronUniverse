import type { PlayerCareerProfile } from '../types'
import bundled from '../../../data/player_career_milestones.json'

/** Bundled fallback — ensures NPC grey chains render even if API omits milestones. */
export const DEFAULT_CAREER_MILESTONES = bundled as Record<string, PlayerCareerProfile>

export function resolveCareerMilestones(
  fromApi: Record<string, PlayerCareerProfile> | undefined | null,
): Record<string, PlayerCareerProfile> {
  if (fromApi && Object.keys(fromApi).length >= 4) return fromApi
  return DEFAULT_CAREER_MILESTONES
}
