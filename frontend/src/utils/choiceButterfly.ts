import type { ChoiceData, PlayerFateDelta, PlayerCareerEvent } from '../types'
import { computeChoiceRipple as ripple, computeChoiceCareerRipple as careerRipple } from './crossImpact'

/** Immediate butterfly effect when LeBron confirms a choice at a James fork. */
export function computeChoiceRipple(forkId: string, choice: ChoiceData): PlayerFateDelta[] {
  return ripple(forkId, choice)
}

/** Day-one parallel career pivots when LeBron confirms a choice. */
export function computeChoiceCareerRipple(
  forkId: string,
  choice: ChoiceData,
): Omit<PlayerCareerEvent, 'id'>[] {
  return careerRipple(forkId, choice)
}
