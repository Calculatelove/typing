import {
  averageHistoricalPerformance,
  type PerformanceHistory,
} from './performanceHistory'
import { performanceRateToBaseSpeed } from './speedModel'
import { PLAYER_SPEED_CONFIG } from './speedConfig'

export type AiDifficulty = 'easy' | 'normal' | 'hard' | 'shadow'

export type AiTemporaryState =
  | { readonly kind: 'steady' }
  | {
      readonly kind: 'slowdown' | 'pause' | 'boost'
      readonly multiplier: number
      readonly endsAt: number
    }

interface AiDifficultyConfig {
  readonly performanceRange: readonly [number, number]
  readonly targetJitter: number
  readonly targetChangeSeconds: readonly [number, number]
  readonly performanceTauSeconds: number
  readonly temporaryChance: number
  readonly temporaryKind: 'easySlowdown' | 'normalSlowdown' | 'hardBoost' | 'none'
  readonly temporaryMultiplier: readonly [number, number]
  readonly temporaryDurationSeconds: readonly [number, number]
  readonly shadowUpdateSeconds?: number
}

export const AI_DIFFICULTY_CONFIG: Readonly<Record<AiDifficulty, AiDifficultyConfig>> = {
  easy: {
    performanceRange: [25, 35],
    targetJitter: 5,
    targetChangeSeconds: [1.2, 2.5],
    performanceTauSeconds: 0.85,
    temporaryChance: 0.35,
    temporaryKind: 'easySlowdown',
    temporaryMultiplier: [0.05, 0.55],
    temporaryDurationSeconds: [0.3, 0.9],
  },
  normal: {
    performanceRange: [40, 55],
    targetJitter: 3,
    targetChangeSeconds: [2, 4],
    performanceTauSeconds: 0.7,
    temporaryChance: 0.16,
    temporaryKind: 'normalSlowdown',
    temporaryMultiplier: [0.88, 0.97],
    temporaryDurationSeconds: [0.25, 0.6],
  },
  hard: {
    performanceRange: [60, 80],
    targetJitter: 2,
    targetChangeSeconds: [3, 5],
    performanceTauSeconds: 0.55,
    temporaryChance: 0.2,
    temporaryKind: 'hardBoost',
    temporaryMultiplier: [1.05, 1.1],
    temporaryDurationSeconds: [0.2, 0.65],
  },
  shadow: {
    performanceRange: [0, PLAYER_SPEED_CONFIG.maximumPerformanceRate],
    targetJitter: 0,
    targetChangeSeconds: [5, 5],
    performanceTauSeconds: 0.8,
    temporaryChance: 0,
    temporaryKind: 'none',
    temporaryMultiplier: [1, 1],
    temporaryDurationSeconds: [0, 0],
    shadowUpdateSeconds: 5,
  },
}

export interface AiControllerState {
  readonly difficulty: AiDifficulty
  readonly baselinePerformanceRate: number
  readonly baseTargetPerformanceRate: number
  readonly currentPerformanceRate: number
  readonly targetPerformanceRate: number
  readonly currentSpeed: number
  readonly targetSpeed: number
  readonly nextTargetChangeTime: number
  readonly lastTargetChangeTime: number
  readonly lastUpdateTime: number
  readonly temporaryState: AiTemporaryState
  readonly randomState: number
}

export interface AiStepInput {
  readonly now: number
  readonly deltaSeconds: number
  readonly trackLength: number
  readonly playerHistory?: PerformanceHistory
}

interface RandomResult {
  readonly value: number
  readonly state: number
}

function nextRandom(randomState: number): RandomResult {
  let nextState = randomState >>> 0
  nextState ^= nextState << 13
  nextState ^= nextState >>> 17
  nextState ^= nextState << 5
  nextState >>>= 0
  return { value: nextState / 0x1_0000_0000, state: nextState }
}

function normalizedSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 0x6d2b79f5
  return (Math.trunc(seed) >>> 0) || 0x6d2b79f5
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

function randomBetween(
  randomState: number,
  range: readonly [number, number],
): { readonly value: number; readonly state: number } {
  const random = nextRandom(randomState)
  return {
    value: range[0] + (range[1] - range[0]) * random.value,
    state: random.state,
  }
}

function steadyState(): AiTemporaryState {
  return { kind: 'steady' }
}

export function createAiController(
  difficulty: AiDifficulty,
  seed: number,
  now: number,
  trackLength: number,
): AiControllerState {
  const config = AI_DIFFICULTY_CONFIG[difficulty]
  const safeNow = Number.isFinite(now) ? Math.max(0, now) : 0
  let randomState = normalizedSeed(seed)
  let baselinePerformanceRate = 45

  if (difficulty !== 'shadow') {
    const baseline = randomBetween(randomState, config.performanceRange)
    baselinePerformanceRate = baseline.value
    randomState = baseline.state
  }

  let interval = config.shadowUpdateSeconds ?? 5
  if (difficulty !== 'shadow') {
    const scheduledInterval = randomBetween(randomState, config.targetChangeSeconds)
    interval = scheduledInterval.value
    randomState = scheduledInterval.state
  }
  const currentSpeed = performanceRateToBaseSpeed(trackLength, baselinePerformanceRate)
  return {
    difficulty,
    baselinePerformanceRate,
    baseTargetPerformanceRate: baselinePerformanceRate,
    currentPerformanceRate: baselinePerformanceRate,
    targetPerformanceRate: baselinePerformanceRate,
    currentSpeed,
    targetSpeed: currentSpeed,
    nextTargetChangeTime: safeNow + interval,
    lastTargetChangeTime: safeNow,
    lastUpdateTime: safeNow,
    temporaryState: steadyState(),
    randomState,
  }
}

function createTemporaryState(
  config: AiDifficultyConfig,
  randomState: number,
  now: number,
): { readonly temporaryState: AiTemporaryState; readonly randomState: number } {
  const eventRoll = nextRandom(randomState)
  if (config.temporaryKind === 'none' || eventRoll.value >= config.temporaryChance) {
    return { temporaryState: steadyState(), randomState: eventRoll.state }
  }

  const multiplier = randomBetween(eventRoll.state, config.temporaryMultiplier)
  const duration = randomBetween(multiplier.state, config.temporaryDurationSeconds)
  const kind = config.temporaryKind === 'hardBoost'
    ? 'boost'
    : config.temporaryKind === 'easySlowdown' && multiplier.value < 0.2
      ? 'pause'
      : 'slowdown'
  return {
    temporaryState: {
      kind,
      multiplier: multiplier.value,
      endsAt: now + duration.value,
    },
    randomState: duration.state,
  }
}

function updateStandardTarget(
  state: AiControllerState,
  scheduledTime: number,
): AiControllerState {
  const config = AI_DIFFICULTY_CONFIG[state.difficulty]
  const jitter = randomBetween(state.randomState, [
    -config.targetJitter,
    config.targetJitter,
  ])
  const interval = randomBetween(jitter.state, config.targetChangeSeconds)
  const temporary = createTemporaryState(config, interval.state, scheduledTime)
  const baseTargetPerformanceRate = clamp(
    state.baselinePerformanceRate + jitter.value,
    config.performanceRange[0],
    config.performanceRange[1],
  )
  return {
    ...state,
    baseTargetPerformanceRate,
    nextTargetChangeTime: scheduledTime + interval.value,
    lastTargetChangeTime: scheduledTime,
    temporaryState: temporary.temporaryState,
    randomState: temporary.randomState,
  }
}

function updateShadowTarget(
  state: AiControllerState,
  scheduledTime: number,
  playerHistory: PerformanceHistory | undefined,
): AiControllerState {
  const config = AI_DIFFICULTY_CONFIG.shadow
  const updateSeconds = config.shadowUpdateSeconds ?? 5
  const historyAverage = playerHistory === undefined
    ? undefined
    : averageHistoricalPerformance(
        playerHistory,
        scheduledTime,
        updateSeconds,
      )
  const random = nextRandom(state.randomState)
  const perturbation = 1 + (random.value * 2 - 1) * 0.025
  const baseTargetPerformanceRate = clamp(
    historyAverage ?? 45,
    config.performanceRange[0],
    config.performanceRange[1],
  )
  return {
    ...state,
    baseTargetPerformanceRate,
    targetPerformanceRate: baseTargetPerformanceRate * perturbation,
    nextTargetChangeTime: scheduledTime + updateSeconds,
    lastTargetChangeTime: scheduledTime,
    temporaryState: steadyState(),
    randomState: random.state,
  }
}

export function stepAiController(
  state: AiControllerState,
  input: AiStepInput,
): AiControllerState {
  const config = AI_DIFFICULTY_CONFIG[state.difficulty]
  const now = Number.isFinite(input.now)
    ? Math.max(state.lastUpdateTime, input.now)
    : state.lastUpdateTime
  const deltaSeconds = Number.isFinite(input.deltaSeconds)
    ? clamp(input.deltaSeconds, 0, PLAYER_SPEED_CONFIG.maximumDeltaSeconds)
    : 0
  let next = state.temporaryState.kind !== 'steady'
    && state.temporaryState.endsAt <= now
    ? { ...state, temporaryState: steadyState() }
    : state

  while (now >= next.nextTargetChangeTime) {
    const scheduledTime = next.nextTargetChangeTime
    next = next.difficulty === 'shadow'
      ? updateShadowTarget(next, scheduledTime, input.playerHistory)
      : updateStandardTarget(next, scheduledTime)
  }
  if (next.temporaryState.kind !== 'steady' && next.temporaryState.endsAt <= now) {
    next = { ...next, temporaryState: steadyState() }
  }

  const temporaryMultiplier = next.temporaryState.kind === 'steady'
    ? 1
    : next.temporaryState.multiplier
  const targetPerformanceRate = next.difficulty === 'shadow'
    ? next.targetPerformanceRate
    : clamp(
        next.baseTargetPerformanceRate * temporaryMultiplier,
        0,
        PLAYER_SPEED_CONFIG.maximumPerformanceRate,
      )
  const smoothing = deltaSeconds === 0
    ? 0
    : 1 - Math.exp(-deltaSeconds / config.performanceTauSeconds)
  const currentPerformanceRate = next.currentPerformanceRate
    + (targetPerformanceRate - next.currentPerformanceRate) * smoothing

  return {
    ...next,
    currentPerformanceRate,
    targetPerformanceRate,
    currentSpeed: performanceRateToBaseSpeed(input.trackLength, currentPerformanceRate),
    targetSpeed: performanceRateToBaseSpeed(input.trackLength, targetPerformanceRate),
    lastUpdateTime: now,
  }
}
