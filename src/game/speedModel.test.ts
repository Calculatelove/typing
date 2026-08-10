import { describe, expect, it } from 'vitest'

import {
  computePlayerTargetSpeed,
  performanceRateToBaseSpeed,
  smoothPlayerSpeed,
} from './speedModel'

const trackLength = 9000

function targetAt(performanceRate: number, overrides: Record<string, number | undefined> = {}) {
  return computePlayerTargetSpeed({
    trackLength,
    performanceRate,
    combo: 0,
    now: 10,
    lastCorrectAt: 10,
    ...overrides,
  })
}

describe('玩家目标速度', () => {
  it('玩家和 AI 可共用相同的表现率基础速度映射', () => {
    expect(performanceRateToBaseSpeed(trackLength, 50)).toBeCloseTo(trackLength / 90, 8)
    expect(targetAt(50).baseSpeed).toBeCloseTo(
      performanceRateToBaseSpeed(trackLength, 50),
      8,
    )
  })

  it.each([30, 50, 80])('表现率 %i 产生单调基础速度', (rate) => {
    expect(targetAt(rate).baseSpeed).toBeCloseTo(trackLength / 90 * rate / 50, 8)
  })

  it('表现率为零时目标速度为零', () => {
    expect(targetAt(0).targetSpeed).toBe(0)
  })

  it('错误立即明显减速并以短暂指数过程恢复', () => {
    const immediate = targetAt(50, { lastErrorAt: 10 })
    const recovering = targetAt(50, { now: 10.7, lastCorrectAt: 10.7, lastErrorAt: 10 })
    const recovered = targetAt(50, { now: 20, lastCorrectAt: 20, lastErrorAt: 10 })

    expect(immediate.errorPenalty).toBeCloseTo(0.55, 8)
    expect(recovering.errorPenalty).toBeGreaterThan(immediate.errorPenalty)
    expect(recovering.errorPenalty).toBeLessThan(1)
    expect(recovered.errorPenalty).toBeCloseTo(1, 5)
  })

  it('连击加成不超过 1.10 且始终只是有限加成', () => {
    expect(targetAt(50, { combo: 10_000 }).comboMultiplier).toBe(1.1)
  })

  it('停止输入后开始衰减并在持续空闲四秒时归零', () => {
    const active = targetAt(50, { now: 10.75, lastCorrectAt: 10 })
    const idle = targetAt(50, { now: 12, lastCorrectAt: 10 })
    const stopped = targetAt(50, { now: 14, lastCorrectAt: 10 })

    expect(active.idleMultiplier).toBe(1)
    expect(idle.idle).toBe(true)
    expect(idle.idleMultiplier).toBeGreaterThan(0)
    expect(idle.idleMultiplier).toBeLessThan(1)
    expect(idle.effectiveCombo).toBe(0)
    expect(stopped.idleMultiplier).toBe(0)
    expect(stopped.targetSpeed).toBe(0)
  })

  it('所有倍率之后仍受最大速度限制', () => {
    const snapshot = targetAt(140, { combo: 10_000 })
    expect(snapshot.targetSpeed).toBeCloseTo(trackLength / 34, 8)
  })
})

describe('实际速度指数平滑', () => {
  function simulate(fps: number): number {
    let speed = 0
    for (let frame = 0; frame < fps; frame += 1) {
      speed = smoothPlayerSpeed(speed, 300, 1 / fps)
    }
    return speed
  }

  it('30、60 和 144 FPS 运行一秒结果接近', () => {
    const at30 = simulate(30)
    expect(simulate(60)).toBeCloseTo(at30, 8)
    expect(simulate(144)).toBeCloseTo(at30, 8)
  })

  it('目标归零后持续平滑减速并最终接近零', () => {
    let speed = 300
    for (let frame = 0; frame < 300; frame += 1) speed = smoothPlayerSpeed(speed, 0, 1 / 60)
    expect(speed).toBeLessThan(0.000001)
  })
})
