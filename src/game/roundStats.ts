export interface RoundStatsState {
  readonly speedDistance: number
  readonly runningSeconds: number
}

export interface FinalRoundStats {
  readonly averageSpeed: number
  readonly accuracy: number
  readonly correct: number
  readonly errors: number
  readonly completionSeconds: number
}

export function createRoundStats(): RoundStatsState {
  return { speedDistance: 0, runningSeconds: 0 }
}

export function recordRoundMotion(
  state: RoundStatsState,
  actualSpeed: number,
  deltaSeconds: number,
): RoundStatsState {
  if (!Number.isFinite(actualSpeed) || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return state
  const speed = Math.max(0, actualSpeed)
  return {
    speedDistance: state.speedDistance + speed * deltaSeconds,
    runningSeconds: state.runningSeconds + deltaSeconds,
  }
}

export function computeAccuracy(correct: number, errors: number): number {
  const safeCorrect = Number.isFinite(correct) ? Math.max(0, correct) : 0
  const safeErrors = Number.isFinite(errors) ? Math.max(0, errors) : 0
  const attempts = safeCorrect + safeErrors
  return attempts === 0 ? 1 : safeCorrect / attempts
}

export function finalizeRoundStats(
  state: RoundStatsState,
  correct: number,
  errors: number,
): FinalRoundStats {
  const safeCorrect = Number.isFinite(correct) ? Math.max(0, correct) : 0
  const safeErrors = Number.isFinite(errors) ? Math.max(0, errors) : 0
  return {
    averageSpeed: state.runningSeconds > 0 ? state.speedDistance / state.runningSeconds : 0,
    accuracy: computeAccuracy(safeCorrect, safeErrors),
    correct: safeCorrect,
    errors: safeErrors,
    completionSeconds: state.runningSeconds,
  }
}
