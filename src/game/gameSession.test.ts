import { describe, expect, it } from 'vitest'

import {
  PLAYER_POLICE,
  PLAYER_THIEF,
  createGameSession,
  transitionGameSession,
  type GameSessionState,
  type PlayerRole,
} from './gameSession'

function runningSession(playerRole: PlayerRole): GameSessionState {
  const setup = createGameSession({ playerRole, difficulty: 'normal' })
  const ready = transitionGameSession(setup, { type: 'prepare' })
  return transitionGameSession(ready, { type: 'firstCorrectInput' })
}

describe('游戏阶段状态机', () => {
  it('只由显式事件完成 setup、ready、running 迁移', () => {
    const setup = createGameSession({
      playerRole: PLAYER_THIEF,
      difficulty: 'normal',
    })
    const ignoredInput = transitionGameSession(setup, { type: 'firstCorrectInput' })
    const ready = transitionGameSession(setup, { type: 'prepare' })
    const running = transitionGameSession(ready, { type: 'firstCorrectInput' })

    expect(setup.phase).toBe('setup')
    expect(ignoredInput).toBe(setup)
    expect(ready.phase).toBe('ready')
    expect(running.phase).toBe('running')
  })

  it.each([
    [PLAYER_THIEF, true, false, 'lost'],
    [PLAYER_THIEF, false, true, 'won'],
    [PLAYER_POLICE, true, false, 'won'],
    [PLAYER_POLICE, false, true, 'lost'],
  ] as const)(
    '%s 在 captured=%s、articleCompleted=%s 时得到 %s',
    (playerRole, captured, articleCompleted, expectedPhase) => {
      const result = transitionGameSession(runningSession(playerRole), {
        type: 'frameResolved',
        captured,
        articleCompleted,
      })

      expect(result.phase).toBe(expectedPhase)
    },
  )

  it.each([
    [PLAYER_THIEF, 'lost'],
    [PLAYER_POLICE, 'won'],
  ] as const)('同帧抓捕和文章完成时抓捕优先：%s → %s', (playerRole, expected) => {
    const result = transitionGameSession(runningSession(playerRole), {
      type: 'frameResolved',
      captured: true,
      articleCompleted: true,
    })

    expect(result.phase).toBe(expected)
  })

  it('终止状态不会被后续模拟事件改写', () => {
    const won = transitionGameSession(runningSession(PLAYER_THIEF), {
      type: 'frameResolved',
      captured: false,
      articleCompleted: true,
    })

    expect(transitionGameSession(won, {
      type: 'frameResolved',
      captured: true,
      articleCompleted: false,
    })).toBe(won)
    expect(transitionGameSession(won, { type: 'firstCorrectInput' })).toBe(won)
  })

  it('重试保留配置并返回 ready，重新配置返回 setup', () => {
    const won = transitionGameSession(runningSession(PLAYER_THIEF), {
      type: 'frameResolved',
      captured: false,
      articleCompleted: true,
    })
    const retried = transitionGameSession(won, { type: 'retry' })
    const configured = transitionGameSession(retried, {
      type: 'configure',
      playerRole: PLAYER_POLICE,
      difficulty: 'hard',
    })

    expect(retried).toEqual({
      phase: 'ready',
      playerRole: PLAYER_THIEF,
      difficulty: 'normal',
    })
    expect(configured).toEqual({
      phase: 'setup',
      playerRole: PLAYER_POLICE,
      difficulty: 'hard',
    })
  })
})
