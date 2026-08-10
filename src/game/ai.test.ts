import { describe, expect, it } from 'vitest'

import {
  AI_DIFFICULTY_CONFIG,
  createAiController,
  stepAiController,
  type AiControllerState,
  type AiDifficulty,
} from './ai'
import { createPerformanceHistory } from './performanceHistory'
import { performanceRateToBaseSpeed } from './speedModel'

const trackLength = 9000

function stepAtNextTarget(state: AiControllerState): AiControllerState {
  return stepAiController(state, {
    now: state.nextTargetChangeTime,
    deltaSeconds: 1 / 60,
    trackLength,
  })
}

function collectTargets(difficulty: AiDifficulty, seed: number, count: number): number[] {
  let state = createAiController(difficulty, seed, 0, trackLength)
  const targets: number[] = []
  for (let index = 0; index < count; index += 1) {
    state = stepAtNextTarget(state)
    targets.push(state.targetPerformanceRate)
  }
  return targets
}

function variance(values: readonly number[]): number {
  const mean = values.reduce((total, value) => total + value, 0) / values.length
  return values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length
}

describe('统一 AI 难度参数', () => {
  it('四档难度使用同一配置形状并符合设计区间', () => {
    expect(Object.keys(AI_DIFFICULTY_CONFIG)).toEqual([
      'easy',
      'normal',
      'hard',
      'shadow',
    ])
    expect(AI_DIFFICULTY_CONFIG.easy.performanceRange).toEqual([25, 35])
    expect(AI_DIFFICULTY_CONFIG.normal.performanceRange).toEqual([40, 55])
    expect(AI_DIFFICULTY_CONFIG.hard.performanceRange).toEqual([60, 80])
    expect(AI_DIFFICULTY_CONFIG.shadow.shadowUpdateSeconds).toBe(5)
  })

  it.each(['easy', 'normal', 'hard'] as const)(
    '%s 到达计划时间时产生新目标和下一计划时间',
    (difficulty) => {
      const initial = createAiController(difficulty, 2026, 0, trackLength)
      const next = stepAtNextTarget(initial)

      expect(next.nextTargetChangeTime).toBeGreaterThan(initial.nextTargetChangeTime)
      expect(next.targetPerformanceRate).not.toBe(initial.targetPerformanceRate)
    },
  )

  it('简单档目标波动显著高于困难档', () => {
    const easyVariance = variance(collectTargets('easy', 91, 120))
    const hardVariance = variance(collectTargets('hard', 91, 120))

    expect(easyVariance).toBeGreaterThan(hardVariance * 2)
  })

  it('困难档偶发 5%～10% 且不超过 0.8 秒的短加速', () => {
    let state = createAiController('hard', 7, 0, trackLength)
    let boost: AiControllerState | undefined
    for (let attempt = 0; attempt < 200 && boost === undefined; attempt += 1) {
      state = stepAtNextTarget(state)
      if (state.temporaryState.kind === 'boost') boost = state
    }

    expect(boost).toBeDefined()
    if (boost?.temporaryState.kind !== 'boost') return
    expect(boost.temporaryState.multiplier).toBeGreaterThanOrEqual(1.05)
    expect(boost.temporaryState.multiplier).toBeLessThanOrEqual(1.1)
    expect(boost.temporaryState.endsAt - boost.lastTargetChangeTime).toBeLessThanOrEqual(0.8)
  })

  it('相同 seed 与时间线完全复现，不同 seed 产生不同序列', () => {
    expect(collectTargets('easy', 1234, 40)).toEqual(
      collectTargets('easy', 1234, 40),
    )
    expect(collectTargets('easy', 1234, 40)).not.toEqual(
      collectTargets('easy', 5678, 40),
    )
  })

  it('跨越多个目标截止点与逐个截止点推进消费相同随机序列', () => {
    const horizon = 20
    const initial = createAiController('easy', 321, 0, trackLength)
    let incremental = initial
    while (incremental.nextTargetChangeTime <= horizon) {
      incremental = stepAiController(incremental, {
        now: incremental.nextTargetChangeTime,
        deltaSeconds: 0,
        trackLength,
      })
    }
    incremental = stepAiController(incremental, {
      now: horizon,
      deltaSeconds: 0,
      trackLength,
    })
    const jumped = stepAiController(initial, {
      now: horizon,
      deltaSeconds: 0,
      trackLength,
    })

    expect(jumped).toEqual(incremental)
  })
})

describe('影子 AI 公平性', () => {
  const pastHistory = createPerformanceHistory([
    { timestamp: 0, rate: 20 },
    { timestamp: 2.5, rate: 60 },
  ])

  it('五秒之前保持中性目标，五秒时按历史平均更新', () => {
    const initial = createAiController('shadow', 44, 0, trackLength)
    const before = stepAiController(initial, {
      now: 4.99,
      deltaSeconds: 0.1,
      trackLength,
      playerHistory: pastHistory,
    })
    const atFive = stepAiController(before, {
      now: 5,
      deltaSeconds: 0.01,
      trackLength,
      playerHistory: pastHistory,
    })

    expect(before.targetPerformanceRate).toBe(45)
    expect(atFive.targetPerformanceRate).toBeGreaterThanOrEqual(39)
    expect(atFive.targetPerformanceRate).toBeLessThanOrEqual(41)
    expect(atFive.nextTargetChangeTime).toBe(10)
    expect(atFive.temporaryState.kind).toBe('steady')
  })

  it('当前结果不受未来玩家样本影响', () => {
    const withFuture = createPerformanceHistory([
      ...pastHistory.samples,
      { timestamp: 6, rate: 140 },
    ])
    const initialA = createAiController('shadow', 99, 0, trackLength)
    const initialB = createAiController('shadow', 99, 0, trackLength)

    const currentA = stepAiController(initialA, {
      now: 5,
      deltaSeconds: 0.1,
      trackLength,
      playerHistory: pastHistory,
    })
    const currentB = stepAiController(initialB, {
      now: 5,
      deltaSeconds: 0.1,
      trackLength,
      playerHistory: withFuture,
    })

    expect(currentB).toEqual(currentA)
  })

  it('跨越多个五秒边界与依次推进得到相同影子目标和随机状态', () => {
    const history = createPerformanceHistory([
      { timestamp: 0, rate: 20 },
      { timestamp: 5, rate: 40 },
      { timestamp: 10, rate: 80 },
      { timestamp: 15, rate: 100 },
    ])
    const initial = createAiController('shadow', 5566, 0, trackLength)
    let incremental = initial
    for (const now of [5, 10, 15]) {
      incremental = stepAiController(incremental, {
        now,
        deltaSeconds: 0,
        trackLength,
        playerHistory: history,
      })
    }
    const jumped = stepAiController(initial, {
      now: 15,
      deltaSeconds: 0,
      trackLength,
      playerHistory: history,
    })

    expect(jumped).toEqual(incremental)
  })

  it('AI 当前速度和目标速度使用共享基础映射', () => {
    const state = stepAiController(
      createAiController('shadow', 12, 0, trackLength),
      { now: 0.5, deltaSeconds: 0.5, trackLength, playerHistory: pastHistory },
    )

    expect(state.currentSpeed).toBeCloseTo(
      performanceRateToBaseSpeed(trackLength, state.currentPerformanceRate),
      8,
    )
    expect(state.targetSpeed).toBeCloseTo(
      performanceRateToBaseSpeed(trackLength, state.targetPerformanceRate),
      8,
    )
  })
})
