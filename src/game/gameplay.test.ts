import { describe, expect, it } from 'vitest'

import { createDebugPursuit } from './engine'
import {
  PLAYER_POLICE,
  PLAYER_THIEF,
  createGameSession,
  transitionGameSession,
  type PlayerRole,
} from './gameSession'
import { finalizeGameplayStep, prepareGameplayStep } from './gameplay'
import { createDefaultTrack } from './track'

const track = createDefaultTrack()
const pursuit = createDebugPursuit(track).state

function runningSession(playerRole: PlayerRole) {
  const setup = createGameSession({ playerRole, difficulty: 'normal' })
  const ready = transitionGameSession(setup, { type: 'prepare' })
  return transitionGameSession(ready, { type: 'firstCorrectInput' })
}

describe('固定步玩法接线', () => {
  it.each([
    [PLAYER_THIEF, 90, 220],
    [PLAYER_POLICE, 220, 90],
  ] as const)('%s 时把玩家速度写入正确角色', (playerRole, policeSpeed, thiefSpeed) => {
    const prepared = prepareGameplayStep(
      pursuit,
      playerRole,
      220,
      90,
    )

    expect(prepared.police.speed).toBe(policeSpeed)
    expect(prepared.thief.speed).toBe(thiefSpeed)
  })

  it.each([
    [PLAYER_THIEF, 'lost'],
    [PLAYER_POLICE, 'won'],
  ] as const)('同一步捕获与完成合并后仍由抓捕优先：%s → %s', (playerRole, phase) => {
    const captured = { ...pursuit, captured: true }
    const result = finalizeGameplayStep(
      runningSession(playerRole),
      captured,
      true,
    )

    expect(result.session.phase).toBe(phase)
    expect(result.terminal).toBe(true)
  })

  it('终局后的重复固定步保持同一 session 并继续要求冻结', () => {
    const won = finalizeGameplayStep(
      runningSession(PLAYER_THIEF),
      pursuit,
      true,
    ).session
    const repeated = finalizeGameplayStep(won, { ...pursuit, captured: true }, false)

    expect(repeated.session).toBe(won)
    expect(repeated.terminal).toBe(true)
  })
})
