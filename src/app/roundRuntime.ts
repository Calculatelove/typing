import {
  createGameSession,
  transitionGameSession,
  type GameSessionState,
} from '../game/gameSession'
import {
  createRollingTypingPerformance,
  recordCorrectInput,
  type RollingTypingPerformance,
} from '../game/rollingTypingPerformance'
import { PLAYER_SPEED_CONFIG } from '../game/speedConfig'
import {
  applyCommittedText,
  createTypingSession,
  type TypingSessionState,
} from '../input'
import type { GameSettings } from './types'

export interface RoundInputRuntime {
  readonly typing: TypingSessionState
  readonly session: GameSessionState
  readonly performance: RollingTypingPerformance
}

export interface RoundCommitOutcome {
  readonly state: RoundInputRuntime
  readonly correctCount: number
  readonly hasError: boolean
  readonly started: boolean
}

export function createRoundInputRuntime(
  articleText: string,
  settings: GameSettings,
): RoundInputRuntime {
  const setup = createGameSession({
    playerRole: settings.playerRole,
    difficulty: settings.difficulty,
  })
  return {
    typing: createTypingSession(articleText),
    session: transitionGameSession(setup, { type: 'prepare' }),
    performance: createRollingTypingPerformance(settings.language),
  }
}

export function applyRoundCommittedText(
  state: RoundInputRuntime,
  text: string,
  timestamp: number,
): RoundCommitOutcome {
  const result = applyCommittedText(state.typing, text, timestamp, {
    comboResetAfterSeconds: PLAYER_SPEED_CONFIG.idleDelaySeconds,
  })
  const correctCount = result.events.filter((event) => event.type === 'correct').length
  const hasError = result.events.some((event) => event.type === 'error')
  const started = correctCount > 0 && state.session.phase === 'ready'
  return {
    state: {
      typing: result.state,
      performance: correctCount > 0
        ? recordCorrectInput(state.performance, timestamp, correctCount)
        : state.performance,
      session: started
        ? transitionGameSession(state.session, { type: 'firstCorrectInput' })
        : state.session,
    },
    correctCount,
    hasError,
    started,
  }
}
