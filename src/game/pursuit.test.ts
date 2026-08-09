import { beforeAll, describe, expect, it } from 'vitest'

import { mod } from './math'
import {
  getPoliceCatchGap,
  getThiefLead,
  stepPursuit,
  validatePursuitConfig,
} from './pursuit'
import { createDefaultTrack } from './track'
import type { Direction, PursuitConfig, PursuitState, Track } from './types'
import { createVehicle } from './vehicle'

let track: Track
let config: PursuitConfig

beforeAll(() => {
  track = createDefaultTrack()
  config = {
    catchDistance: track.length * 0.01,
    reverseThreshold: track.length * 0.1,
    reverseHysteresis: track.length * 0.02,
    reverseCooldownSeconds: 0.2,
    maxDeltaSeconds: 0.1,
  }
})

interface StateOptions {
  readonly lead: number
  readonly direction?: Direction
  readonly policePosition?: number
  readonly policeSpeed: number
  readonly thiefSpeed: number
  readonly reverseArmed?: boolean
  readonly reverseCooldownRemaining?: number
  readonly reverseCount?: number
}

function makeState({
  lead,
  direction = 1,
  policePosition = track.length * 0.2,
  policeSpeed,
  thiefSpeed,
  reverseArmed = true,
  reverseCooldownRemaining = 0,
  reverseCount = 0,
}: StateOptions): PursuitState {
  const thiefPosition = mod(policePosition + direction * lead, track.length)
  return {
    police: createVehicle(track, 'police', policePosition, policeSpeed, direction),
    thief: createVehicle(track, 'thief', thiefPosition, thiefSpeed, direction),
    captured: false,
    reverseArmed,
    reverseCooldownRemaining,
    reverseCount,
  }
}

describe('有向环形距离', () => {
  it.each([
    { police: 10, thief: 40, direction: 1 as const, expected: 30 },
    { police: 40, thief: 10, direction: -1 as const, expected: 30 },
    { police: 95, thief: 5, direction: 1 as const, expected: 10 },
    { police: 5, thief: 95, direction: -1 as const, expected: 10 },
  ])(
    '在正反方向和跨零点情况下返回正确距离',
    ({ police, thief, direction, expected }) => {
      expect(getThiefLead(police, thief, direction, 100)).toBe(expected)
      expect(getPoliceCatchGap(police, thief, direction, 100)).toBe(expected)
    },
  )
})

describe('追逐参数', () => {
  it('接受抓捕阈值远小于掉头阈值的配置', () => {
    expect(() => validatePursuitConfig(track.length, config)).not.toThrow()
  })

  it('拒绝破坏追逐不变量的配置', () => {
    const invalidOverrides: readonly Partial<PursuitConfig>[] = [
      { catchDistance: 0 },
      { reverseThreshold: config.catchDistance * 4 },
      { reverseThreshold: track.length / 2 },
      { reverseHysteresis: -1 },
      { reverseCooldownSeconds: -1 },
      { maxDeltaSeconds: 0 },
    ]

    for (const override of invalidOverrides) {
      expect(() => validatePursuitConfig(track.length, { ...config, ...override })).toThrow()
    }
  })
})

describe('抓捕事件', () => {
  it.each([1, -1] as const)(
    '方向为 %s 时，警察向下穿越 catchDistance 才触发抓捕',
    (direction) => {
      const state = makeState({
        lead: config.catchDistance + 2,
        direction,
        policeSpeed: 30,
        thiefSpeed: 10,
      })
      const next = stepPursuit(track, state, 0.1, config)

      expect(next.captured).toBe(true)
      expect(
        getThiefLead(
          next.police.trackPosition,
          next.thief.trackPosition,
          next.police.direction,
          track.length,
        ),
      ).toBeCloseTo(config.catchDistance, 7)
    },
  )

  it('跨越 trackPosition=0 追上时仍正确抓捕', () => {
    const state = makeState({
      lead: config.catchDistance + 2,
      policePosition: track.length - 1,
      policeSpeed: 30,
      thiefSpeed: 10,
    })

    expect(stepPursuit(track, state, 0.1, config).captured).toBe(true)
  })

  it('警察没有相对接近时不会仅因距离小而抓捕', () => {
    const state = makeState({
      lead: config.catchDistance * 0.5,
      policeSpeed: 10,
      thiefSpeed: 20,
    })

    expect(stepPursuit(track, state, 0.1, config).captured).toBe(false)
  })

  it('小偷接近套圈时即使世界坐标接近也不触发抓捕', () => {
    const state = makeState({
      lead: track.length - config.reverseThreshold - 0.5,
      policeSpeed: 10,
      thiefSpeed: 20,
    })
    const next = stepPursuit(track, state, 0.1, config)

    expect(next.captured).toBe(false)
    expect(next.reverseCount).toBe(1)
  })
})

describe('快套圈同步掉头', () => {
  it.each([1, -1] as const)('方向为 %s 时双方在阈值穿越时恰好掉头一次', (direction) => {
    const threshold = track.length - config.reverseThreshold
    const state = makeState({
      lead: threshold - 1,
      direction,
      policeSpeed: 10,
      thiefSpeed: 30,
    })
    const next = stepPursuit(track, state, 0.05, config)
    const expectedDirection = direction === 1 ? -1 : 1

    expect(next.reverseCount).toBe(1)
    expect(next.police.direction).toBe(expectedDirection)
    expect(next.thief.direction).toBe(expectedDirection)
    expect(next.police.trackPosition).toBeCloseTo(
      mod(state.police.trackPosition + direction * 0.5, track.length),
      7,
    )
    expect(next.thief.trackPosition).toBeCloseTo(
      mod(state.thief.trackPosition + direction * 1.5, track.length),
      7,
    )
    expect(next.captured).toBe(false)
  })

  it('掉头动作本身不改变双方弧长位置和世界坐标', () => {
    const state = makeState({
      lead: track.length - config.reverseThreshold,
      policeSpeed: 10,
      thiefSpeed: 30,
    })
    const next = stepPursuit(track, state, 0, config)

    expect(next.police.trackPosition).toBe(state.police.trackPosition)
    expect(next.thief.trackPosition).toBe(state.thief.trackPosition)
    expect(next.police.worldPosition).toEqual(state.police.worldPosition)
    expect(next.thief.worldPosition).toEqual(state.thief.worldPosition)
    expect(next.reverseCount).toBe(1)
  })

  it('掉头后按新方向重新计算为 reverseThreshold 的距离关系', () => {
    const state = makeState({
      lead: track.length - config.reverseThreshold,
      policeSpeed: 10,
      thiefSpeed: 30,
    })
    const next = stepPursuit(track, state, 0, config)

    expect(
      getThiefLead(
        next.police.trackPosition,
        next.thief.trackPosition,
        next.police.direction,
        track.length,
      ),
    ).toBeCloseTo(config.reverseThreshold, 7)
  })

  it('cooldown 与 armed 状态阻止连续多帧反复掉头', () => {
    const threshold = track.length - config.reverseThreshold
    const first = stepPursuit(
      track,
      makeState({ lead: threshold, policeSpeed: 10, thiefSpeed: 30 }),
      0,
      config,
    )
    const second = stepPursuit(track, first, 0.01, config)
    const third = stepPursuit(track, second, 0.01, config)

    expect([first.reverseCount, second.reverseCount, third.reverseCount]).toEqual([1, 1, 1])
    expect(third.reverseArmed).toBe(false)
  })

  it('冷却结束且离开 hysteresis 区域后才重新 armed', () => {
    const threshold = track.length - config.reverseThreshold
    let state = stepPursuit(
      track,
      makeState({ lead: threshold, policeSpeed: 10, thiefSpeed: 30 }),
      0,
      config,
    )
    state = stepPursuit(track, state, 0.1, config)
    expect(state.reverseArmed).toBe(false)
    state = stepPursuit(track, state, 0.1, config)

    expect(state.reverseCooldownRemaining).toBe(0)
    expect(state.reverseArmed).toBe(true)
    expect(state.reverseCount).toBe(1)
  })

  it('执行掉头后用新方向完成当前时间步的剩余部分', () => {
    const threshold = track.length - config.reverseThreshold
    const state = makeState({ lead: threshold - 1, policeSpeed: 10, thiefSpeed: 30 })
    const next = stepPursuit(track, state, 0.1, config)

    expect(next.police.trackPosition).toBeCloseTo(state.police.trackPosition, 7)
    expect(next.thief.trackPosition).toBeCloseTo(state.thief.trackPosition, 7)
    expect(
      getThiefLead(
        next.police.trackPosition,
        next.thief.trackPosition,
        next.police.direction,
        track.length,
      ),
    ).toBeCloseTo(config.reverseThreshold + 1, 7)
  })

  it('核心单步也限制异常大的 dt', () => {
    const state = makeState({ lead: track.length * 0.4, policeSpeed: 10, thiefSpeed: 10 })
    const next = stepPursuit(track, state, 30, config)

    expect(next.police.trackPosition).toBeCloseTo(state.police.trackPosition + 1, 7)
    expect(next.thief.trackPosition).toBeCloseTo(state.thief.trackPosition + 1, 7)
  })
})
