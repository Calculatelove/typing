export type TypingLanguage = 'english' | 'chinese'

export interface RollingTypingPerformance {
  readonly language: TypingLanguage
  readonly runningStartedAt?: number
  readonly correctTimestamps: readonly number[]
}

export interface RecentPerformanceSnapshot {
  readonly state: RollingTypingPerformance
  readonly rate: number
  readonly recentCount: number
  readonly observationSeconds: number
}

export function createRollingTypingPerformance(
  language: TypingLanguage,
  runningStartedAt?: number,
): RollingTypingPerformance {
  return { language, runningStartedAt, correctTimestamps: [] }
}

export function recordCorrectInput(
  state: RollingTypingPerformance,
  timestamp: number,
  count = 1,
): RollingTypingPerformance {
  if (!Number.isFinite(timestamp) || !Number.isFinite(count) || count <= 0) return state
  const safeCount = Math.floor(count)
  return {
    ...state,
    runningStartedAt: state.runningStartedAt ?? timestamp,
    correctTimestamps: [
      ...state.correctTimestamps,
      ...Array.from({ length: safeCount }, () => timestamp),
    ],
  }
}

export function getRecentPerformance(
  state: RollingTypingPerformance,
  now: number,
): RecentPerformanceSnapshot {
  const safeNow = Number.isFinite(now) ? now : state.runningStartedAt ?? 0
  const threshold = safeNow - PLAYER_SPEED_CONFIG.performanceWindowSeconds
  const correctTimestamps = state.correctTimestamps.filter(
    (timestamp) => timestamp >= threshold && timestamp <= safeNow,
  )
  const observationSeconds = state.runningStartedAt === undefined
    ? PLAYER_SPEED_CONFIG.minimumObservationSeconds
    : Math.max(
        PLAYER_SPEED_CONFIG.minimumObservationSeconds,
        Math.min(
          PLAYER_SPEED_CONFIG.performanceWindowSeconds,
          Math.max(0, safeNow - state.runningStartedAt),
        ),
      )
  const unitsPerMinute = correctTimestamps.length * 60 / observationSeconds
  const rawRate = state.language === 'english' ? unitsPerMinute / 5 : unitsPerMinute
  return {
    state: { ...state, correctTimestamps },
    rate: Math.min(PLAYER_SPEED_CONFIG.maximumPerformanceRate, rawRate),
    recentCount: correctTimestamps.length,
    observationSeconds,
  }
}
import { PLAYER_SPEED_CONFIG } from './speedConfig'
