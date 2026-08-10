import { stepPursuit, validatePursuitConfig } from './pursuit'
import type { PursuitConfig, PursuitState, Track } from './types'
import { createVehicle } from './vehicle'
import { createWorldPursuitConfig } from './worldConfig'

export const FIXED_STEP_SECONDS = 1 / 60
export const MAX_FIXED_STEPS_PER_FRAME = 6

export interface PursuitFrameState {
  readonly state: PursuitState
  readonly accumulatorSeconds: number
}

export interface DebugPursuit {
  readonly state: PursuitState
  readonly config: PursuitConfig
}

export type PreparePursuitStep = (
  state: PursuitState,
  stepSeconds: number,
) => PursuitState

export type FinalizePursuitStep = (
  state: PursuitState,
  stepSeconds: number,
) => boolean

export function createDebugPursuit(track: Track): DebugPursuit {
  const config: PursuitConfig = createWorldPursuitConfig(track)
  validatePursuitConfig(track.length, config)

  const policePosition = track.length * 0.15
  const thiefPosition = track.length * 0.85
  return {
    config,
    state: {
      police: createVehicle(track, 'police', policePosition, track.length / 30, 1),
      thief: createVehicle(track, 'thief', thiefPosition, track.length / 12, 1),
      captured: false,
      reverseArmed: true,
      reverseCooldownRemaining: 0,
      reverseCount: 0,
    },
  }
}

export function advancePursuitFrame(
  track: Track,
  frame: PursuitFrameState,
  frameDeltaSeconds: number,
  config: PursuitConfig,
  prepareStep?: PreparePursuitStep,
  finalizeStep?: FinalizePursuitStep,
): PursuitFrameState {
  if (config.maxDeltaSeconds < FIXED_STEP_SECONDS) {
    throw new RangeError('最大 delta time 不能小于固定时间步。')
  }

  const safeFrameDelta = Number.isFinite(frameDeltaSeconds) && frameDeltaSeconds > 0
    ? Math.min(frameDeltaSeconds, config.maxDeltaSeconds)
    : 0
  let accumulatorSeconds = Math.max(0, frame.accumulatorSeconds) + safeFrameDelta
  let state = frame.state
  let completedSteps = 0
  let stoppedByFinalizer = false
  const epsilon = 1e-12

  while (
    accumulatorSeconds + epsilon >= FIXED_STEP_SECONDS &&
    completedSteps < MAX_FIXED_STEPS_PER_FRAME &&
    !state.captured
  ) {
    if (prepareStep !== undefined) state = prepareStep(state, FIXED_STEP_SECONDS)
    state = stepPursuit(track, state, FIXED_STEP_SECONDS, config)
    accumulatorSeconds -= FIXED_STEP_SECONDS
    completedSteps += 1
    if (finalizeStep?.(state, FIXED_STEP_SECONDS) === true) {
      stoppedByFinalizer = true
      break
    }
  }

  if (state.captured || stoppedByFinalizer) {
    accumulatorSeconds = 0
  } else if (completedSteps === MAX_FIXED_STEPS_PER_FRAME) {
    accumulatorSeconds = Math.min(accumulatorSeconds, FIXED_STEP_SECONDS)
  }

  return {
    state,
    accumulatorSeconds: Math.max(0, accumulatorSeconds),
  }
}
