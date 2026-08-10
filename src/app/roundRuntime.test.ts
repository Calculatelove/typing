import { describe, expect, it } from 'vitest'

import { FIXTURE_ARTICLES } from '../articles'
import { PLAYER_POLICE, PLAYER_THIEF } from '../game/gameSession'
import { finalizeGameplayStep, prepareGameplayStep } from '../game/gameplay'
import { createDebugPursuit } from '../game/engine'
import { createDefaultTrack } from '../game/track'
import { consumeImeFallback, createImeInputState, reduceImeInput } from '../input'
import { DEFAULT_GAME_SETTINGS } from './settings'
import { applyRoundCommittedText, createRoundInputRuntime } from './roundRuntime'

describe('正式本局接线', () => {
  it('中文 composition 只把正式 commit 交给会话一次，首个正确输入启动', () => {
    let ime = reduceImeInput(createImeInputState(), { type: 'compositionstart' }).state
    const ended = reduceImeInput(ime, { type: 'compositionend', text: '清' })
    ime = ended.state
    const fallback = consumeImeFallback(ime, ended.fallbackVersion!)

    let runtime = createRoundInputRuntime('清晨', {
      ...DEFAULT_GAME_SETTINGS,
      language: 'chinese',
    })
    const committed = applyRoundCommittedText(runtime, fallback.committedText!, 0)
    runtime = committed.state
    expect(committed.correctCount).toBe(1)
    expect(committed.started).toBe(true)
    expect(runtime.session.phase).toBe('running')

    const duplicate = reduceImeInput(fallback.state, {
      type: 'input', text: '清', isComposing: false,
    })
    expect(duplicate.committedText).toBeUndefined()
    expect(runtime.typing.correctCount).toBe(1)
  })

  it('错误不推进，随后正确提交保留 running 并完成文章', () => {
    let runtime = createRoundInputRuntime('go', DEFAULT_GAME_SETTINGS)
    const wrong = applyRoundCommittedText(runtime, 'x', 0)
    expect(wrong.hasError).toBe(true)
    expect(wrong.state.typing.correctIndex).toBe(0)
    runtime = applyRoundCommittedText(wrong.state, 'go', 0.2).state
    expect(runtime.typing.completed).toBe(true)
    expect(runtime.session.phase).toBe('running')
  })

  it('两种玩家身份把速度接到正确车辆，同步终局仍由抓捕优先', () => {
    const track = createDefaultTrack()
    const pursuit = createDebugPursuit(track).state
    const thiefPlayer = prepareGameplayStep(pursuit, PLAYER_THIEF, 111, 222)
    expect([thiefPlayer.thief.speed, thiefPlayer.police.speed]).toEqual([111, 222])
    const policePlayer = prepareGameplayStep(pursuit, PLAYER_POLICE, 111, 222)
    expect([policePlayer.police.speed, policePlayer.thief.speed]).toEqual([111, 222])

    const runtime = createRoundInputRuntime('a', {
      ...DEFAULT_GAME_SETTINGS,
      playerRole: PLAYER_POLICE,
    })
    const running = applyRoundCommittedText(runtime, 'a', 0).state
    const terminal = finalizeGameplayStep(running.session, { ...pursuit, captured: true }, true)
    expect(terminal.session.phase).toBe('won')
    expect(terminal.terminal).toBe(true)
  })

  it('fixture、设置和正式运行时可组合创建', () => {
    const article = FIXTURE_ARTICLES[0]!
    const runtime = createRoundInputRuntime(article.text, DEFAULT_GAME_SETTINGS)
    expect(runtime.typing.targetGraphemes).toHaveLength(article.scoredGraphemeCount)
    expect(runtime.session.phase).toBe('ready')
  })
})
