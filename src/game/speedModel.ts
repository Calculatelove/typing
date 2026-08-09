import { PLAYER_SPEED_CONFIG } from './speedConfig'

export interface PlayerTargetSpeedInput {
  readonly trackLength: number
  readonly performanceRate: number
  readonly combo: number
  readonly now: number
  readonly lastCorrectAt?: number
  readonly lastErrorAt?: number
}

export interface PlayerSpeedSnapshot {
  readonly performanceRate: number
  readonly baseSpeed: number
  readonly effectiveCombo: number
  readonly comboMultiplier: number
  readonly errorPenalty: number
  readonly idleMultiplier: number
  readonly idle: boolean
  readonly targetSpeed: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function smoothStep(value: number): number {
  const clamped = clamp01(value)
  return clamped * clamped * (3 - 2 * clamped)
}

export function computePlayerTargetSpeed(input: PlayerTargetSpeedInput): PlayerSpeedSnapshot {
  const safeTrackLength = Math.max(0, Number.isFinite(input.trackLength) ? input.trackLength : 0)
  const performanceRate = Math.max(
    0,
    Math.min(
      PLAYER_SPEED_CONFIG.maximumPerformanceRate,
      Number.isFinite(input.performanceRate) ? input.performanceRate : 0,
    ),
  )
  const baseSpeed = safeTrackLength / PLAYER_SPEED_CONFIG.referenceLapSeconds
    * performanceRate / PLAYER_SPEED_CONFIG.referencePerformanceRate
  const idleElapsed = input.lastCorrectAt === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0, input.now - input.lastCorrectAt)
  const idle = idleElapsed > PLAYER_SPEED_CONFIG.idleDelaySeconds
  const idleProgress = (idleElapsed - PLAYER_SPEED_CONFIG.idleDelaySeconds)
    / (PLAYER_SPEED_CONFIG.idleStopSeconds - PLAYER_SPEED_CONFIG.idleDelaySeconds)
  const idleMultiplier = input.lastCorrectAt === undefined
    ? 0
    : idle
      ? 1 - smoothStep(idleProgress)
      : 1
  const comboMultiplier = idle
    ? 1
    : Math.min(
        PLAYER_SPEED_CONFIG.comboMaximum,
        1 + Math.max(0, input.combo) * PLAYER_SPEED_CONFIG.comboStep,
      )
  const errorElapsed = input.lastErrorAt === undefined
    ? Number.POSITIVE_INFINITY
    : Math.max(0, input.now - input.lastErrorAt)
  const errorPenalty = input.lastErrorAt === undefined
    ? 1
    : 1 - (1 - PLAYER_SPEED_CONFIG.errorPenaltyMinimum)
      * Math.exp(-errorElapsed / PLAYER_SPEED_CONFIG.errorRecoveryTauSeconds)
  const maximumSpeed = safeTrackLength / PLAYER_SPEED_CONFIG.maximumLapSeconds
  const targetSpeed = Math.min(
    maximumSpeed,
    baseSpeed * comboMultiplier * errorPenalty * idleMultiplier,
  )
  return {
    performanceRate,
    baseSpeed,
    effectiveCombo: idle ? 0 : Math.max(0, input.combo),
    comboMultiplier,
    errorPenalty,
    idleMultiplier,
    idle,
    targetSpeed,
  }
}

export function smoothPlayerSpeed(
  actualSpeed: number,
  targetSpeed: number,
  deltaSeconds: number,
): number {
  const actual = Math.max(0, Number.isFinite(actualSpeed) ? actualSpeed : 0)
  const target = Math.max(0, Number.isFinite(targetSpeed) ? targetSpeed : 0)
  const delta = Math.max(
    0,
    Math.min(
      PLAYER_SPEED_CONFIG.maximumDeltaSeconds,
      Number.isFinite(deltaSeconds) ? deltaSeconds : 0,
    ),
  )
  if (delta === 0) return actual
  const tau = target >= actual
    ? PLAYER_SPEED_CONFIG.accelerationTauSeconds
    : PLAYER_SPEED_CONFIG.decelerationTauSeconds
  return actual + (target - actual) * (1 - Math.exp(-delta / tau))
}
