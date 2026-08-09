import { mod } from './math'
import type { Direction, PursuitConfig, PursuitState, Track } from './types'
import { MAX_DELTA_SECONDS, advanceVehicle, reverseVehicle } from './vehicle'

export function getThiefLead(
  policePosition: number,
  thiefPosition: number,
  direction: Direction,
  trackLength: number,
): number {
  return mod((thiefPosition - policePosition) * direction, trackLength)
}

export function getPoliceCatchGap(
  policePosition: number,
  thiefPosition: number,
  direction: Direction,
  trackLength: number,
): number {
  return getThiefLead(policePosition, thiefPosition, direction, trackLength)
}

export function validatePursuitConfig(
  trackLength: number,
  config: PursuitConfig,
): void {
  if (!Number.isFinite(trackLength) || trackLength <= 0) {
    throw new RangeError('道路总长度必须是有限正数。')
  }

  const values = Object.values(config)
  if (values.some((value) => !Number.isFinite(value))) {
    throw new RangeError('追逐参数必须全部是有限数。')
  }
  if (config.catchDistance <= 0) {
    throw new RangeError('抓捕距离必须大于零。')
  }
  if (
    config.reverseThreshold <= config.catchDistance ||
    config.reverseThreshold >= trackLength / 2
  ) {
    throw new RangeError('掉头阈值必须大于抓捕距离且小于半圈。')
  }
  if (config.reverseThreshold < config.catchDistance * 5) {
    throw new RangeError('掉头阈值必须至少是抓捕距离的五倍。')
  }
  if (
    config.reverseHysteresis < 0 ||
    config.reverseHysteresis >= trackLength - config.reverseThreshold * 2
  ) {
    throw new RangeError('掉头 hysteresis 必须非负且保留可重新 armed 的区间。')
  }
  if (config.reverseCooldownSeconds < 0) {
    throw new RangeError('掉头 cooldown 不能是负数。')
  }
  if (config.maxDeltaSeconds <= 0 || config.maxDeltaSeconds > MAX_DELTA_SECONDS) {
    throw new RangeError('最大 delta time 必须大于零且不能超过 0.1 秒。')
  }
}

function leadForState(track: Track, state: PursuitState): number {
  return getThiefLead(
    state.police.trackPosition,
    state.thief.trackPosition,
    state.police.direction,
    track.length,
  )
}

function advanceBoth(
  track: Track,
  state: PursuitState,
  deltaSeconds: number,
  maxDeltaSeconds: number,
): PursuitState {
  return {
    ...state,
    police: advanceVehicle(track, state.police, deltaSeconds, maxDeltaSeconds),
    thief: advanceVehicle(track, state.thief, deltaSeconds, maxDeltaSeconds),
  }
}

function updateReverseGuard(
  track: Track,
  state: PursuitState,
  elapsedSeconds: number,
  config: PursuitConfig,
): PursuitState {
  const reverseCooldownRemaining = Math.max(
    0,
    state.reverseCooldownRemaining - elapsedSeconds,
  )
  const rearmBoundary = track.length - config.reverseThreshold - config.reverseHysteresis
  const reverseArmed = state.reverseArmed || (
    reverseCooldownRemaining === 0 && leadForState(track, state) < rearmBoundary
  )

  return { ...state, reverseCooldownRemaining, reverseArmed }
}

export function stepPursuit(
  track: Track,
  state: PursuitState,
  deltaSeconds: number,
  config: PursuitConfig,
): PursuitState {
  validatePursuitConfig(track.length, config)
  if (state.police.direction !== state.thief.direction) {
    throw new Error('警察和小偷必须保持同向。')
  }
  if (state.captured) {
    return state
  }

  const safeDelta = Number.isFinite(deltaSeconds) && deltaSeconds > 0
    ? Math.min(deltaSeconds, config.maxDeltaSeconds)
    : 0
  const lead = leadForState(track, state)
  const relativeSpeed = state.thief.speed - state.police.speed
  const epsilon = Math.max(1e-9, track.length * 1e-12)

  if (relativeSpeed < -epsilon && lead > config.catchDistance + epsilon) {
    const catchTime = Math.max(
      0,
      (lead - config.catchDistance) / -relativeSpeed,
    )
    if (catchTime <= safeDelta + epsilon) {
      const atCatch = advanceBoth(
        track,
        state,
        Math.min(catchTime, safeDelta),
        config.maxDeltaSeconds,
      )
      return { ...atCatch, captured: true }
    }
  }

  const reverseBoundary = track.length - config.reverseThreshold
  if (
    relativeSpeed > epsilon &&
    state.reverseArmed &&
    lead <= reverseBoundary + epsilon
  ) {
    const reverseTime = lead >= reverseBoundary - epsilon
      ? 0
      : (reverseBoundary - lead) / relativeSpeed
    if (reverseTime <= safeDelta + epsilon) {
      const timeBeforeReverse = Math.min(Math.max(reverseTime, 0), safeDelta)
      const atReverse = advanceBoth(
        track,
        state,
        timeBeforeReverse,
        config.maxDeltaSeconds,
      )
      let reversed: PursuitState = {
        ...atReverse,
        police: reverseVehicle(track, atReverse.police),
        thief: reverseVehicle(track, atReverse.thief),
        reverseArmed: false,
        reverseCooldownRemaining: config.reverseCooldownSeconds,
        reverseCount: state.reverseCount + 1,
      }
      const remainingTime = safeDelta - timeBeforeReverse
      reversed = advanceBoth(track, reversed, remainingTime, config.maxDeltaSeconds)
      return updateReverseGuard(track, reversed, remainingTime, config)
    }
  }

  const advanced = advanceBoth(track, state, safeDelta, config.maxDeltaSeconds)
  return updateReverseGuard(track, advanced, safeDelta, config)
}
