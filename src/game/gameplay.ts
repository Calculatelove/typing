import {
  PLAYER_THIEF,
  transitionGameSession,
  type GameSessionState,
  type PlayerRole,
} from './gameSession'
import type { PursuitState } from './types'

export interface GameplayStepResult {
  readonly session: GameSessionState
  readonly terminal: boolean
}

export function prepareGameplayStep(
  pursuit: PursuitState,
  playerRole: PlayerRole,
  playerSpeed: number,
  aiSpeed: number,
): PursuitState {
  const safePlayerSpeed = Number.isFinite(playerSpeed) && playerSpeed >= 0
    ? playerSpeed
    : 0
  const safeAiSpeed = Number.isFinite(aiSpeed) && aiSpeed >= 0 ? aiSpeed : 0
  const playerControlsThief = playerRole === PLAYER_THIEF
  return {
    ...pursuit,
    police: {
      ...pursuit.police,
      speed: playerControlsThief ? safeAiSpeed : safePlayerSpeed,
    },
    thief: {
      ...pursuit.thief,
      speed: playerControlsThief ? safePlayerSpeed : safeAiSpeed,
    },
  }
}

export function finalizeGameplayStep(
  session: GameSessionState,
  pursuit: PursuitState,
  articleCompleted: boolean,
): GameplayStepResult {
  const nextSession = transitionGameSession(session, {
    type: 'frameResolved',
    captured: pursuit.captured,
    articleCompleted,
  })
  return {
    session: nextSession,
    terminal: nextSession.phase === 'won' || nextSession.phase === 'lost',
  }
}
