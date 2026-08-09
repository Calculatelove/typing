import { mod } from './math'
import { sampleTrackAt } from './track'
import type { Direction, Track, VehicleRole, VehicleState } from './types'

export const MAX_DELTA_SECONDS = 0.1

export function createVehicle(
  track: Track,
  role: VehicleRole,
  trackPosition: number,
  speed: number,
  direction: Direction,
): VehicleState {
  if (!Number.isFinite(speed) || speed < 0) {
    throw new RangeError('车辆速度必须是有限非负数。')
  }
  if (direction !== 1 && direction !== -1) {
    throw new RangeError('车辆方向只能是 1 或 -1。')
  }

  const normalizedPosition = mod(trackPosition, track.length)
  const trackSample = sampleTrackAt(track, normalizedPosition)
  return {
    role,
    trackPosition: normalizedPosition,
    speed,
    direction,
    worldPosition: trackSample.position,
    heading: trackSample.heading + (direction === -1 ? Math.PI : 0),
  }
}

export function advanceVehicle(
  track: Track,
  vehicle: VehicleState,
  deltaSeconds: number,
  maxDeltaSeconds = MAX_DELTA_SECONDS,
): VehicleState {
  if (!Number.isFinite(maxDeltaSeconds) || maxDeltaSeconds <= 0) {
    throw new RangeError('最大 delta time 必须是有限正数。')
  }

  const safeDelta = Number.isFinite(deltaSeconds) && deltaSeconds > 0
    ? Math.min(deltaSeconds, maxDeltaSeconds)
    : 0
  return createVehicle(
    track,
    vehicle.role,
    vehicle.trackPosition + vehicle.direction * vehicle.speed * safeDelta,
    vehicle.speed,
    vehicle.direction,
  )
}

export function reverseVehicle(track: Track, vehicle: VehicleState): VehicleState {
  const nextDirection: Direction = vehicle.direction === 1 ? -1 : 1
  return createVehicle(
    track,
    vehicle.role,
    vehicle.trackPosition,
    vehicle.speed,
    nextDirection,
  )
}
