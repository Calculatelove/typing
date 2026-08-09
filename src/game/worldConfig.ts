import type { PursuitConfig, Track } from './types'

export const WORLD_SCALE = 2.4
export const DEFAULT_WORLD_ROAD_WIDTH = 120
export const VEHICLE_RULE_LENGTH = 72
export const VEHICLE_VISUAL = { length: 76, width: 30, riderHeight: 82 } as const

export function createWorldPursuitConfig(
  track: Pick<Track, 'length' | 'roadWidth'>,
): PursuitConfig {
  const catchDistance = Math.max(VEHICLE_RULE_LENGTH * 0.9, track.roadWidth * 0.42)
  return {
    catchDistance,
    reverseThreshold: Math.max(track.length * 0.1, catchDistance * 5),
    reverseHysteresis: track.length * 0.02,
    reverseCooldownSeconds: 0.75,
    maxDeltaSeconds: 0.1,
  }
}
