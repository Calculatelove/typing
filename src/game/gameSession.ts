import type { AiDifficulty } from './ai'

export const PLAYER_POLICE = 'PLAYER_POLICE'
export const PLAYER_THIEF = 'PLAYER_THIEF'

export type PlayerRole = typeof PLAYER_POLICE | typeof PLAYER_THIEF
export type GamePhase = 'setup' | 'ready' | 'running' | 'won' | 'lost'

export interface GameSessionConfig {
  readonly playerRole: PlayerRole
  readonly difficulty: AiDifficulty
}

export interface GameSessionState extends GameSessionConfig {
  readonly phase: GamePhase
}

export type GameSessionEvent =
  | { readonly type: 'prepare' }
  | { readonly type: 'firstCorrectInput' }
  | {
      readonly type: 'frameResolved'
      readonly captured: boolean
      readonly articleCompleted: boolean
    }
  | { readonly type: 'retry' }
  | ({ readonly type: 'configure' } & GameSessionConfig)

export function createGameSession(config: GameSessionConfig): GameSessionState {
  return { ...config, phase: 'setup' }
}

export function transitionGameSession(
  state: GameSessionState,
  event: GameSessionEvent,
): GameSessionState {
  if (event.type === 'configure') {
    return createGameSession({
      playerRole: event.playerRole,
      difficulty: event.difficulty,
    })
  }
  if (event.type === 'retry') return { ...state, phase: 'ready' }
  if (state.phase === 'won' || state.phase === 'lost') return state

  if (state.phase === 'setup' && event.type === 'prepare') {
    return { ...state, phase: 'ready' }
  }
  if (state.phase === 'ready' && event.type === 'firstCorrectInput') {
    return { ...state, phase: 'running' }
  }
  if (state.phase !== 'running' || event.type !== 'frameResolved') return state

  if (event.captured) {
    return {
      ...state,
      phase: state.playerRole === PLAYER_POLICE ? 'won' : 'lost',
    }
  }
  if (event.articleCompleted) {
    return {
      ...state,
      phase: state.playerRole === PLAYER_THIEF ? 'won' : 'lost',
    }
  }
  return state
}
