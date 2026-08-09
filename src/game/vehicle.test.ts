import { beforeAll, describe, expect, it } from 'vitest'

import { createClosedTrack } from './track'
import type { Track } from './types'
import {
  MAX_DELTA_SECONDS,
  advanceVehicle,
  createVehicle,
  reverseVehicle,
} from './vehicle'

let track: Track

beforeAll(() => {
  track = createClosedTrack([
    { x: -100, y: -80 },
    { x: 160, y: -100 },
    { x: 180, y: 130 },
    { x: -140, y: 150 },
  ])
})

describe('车辆运动', () => {
  it.each([
    { direction: 1 as const, start: 10, speed: 20, dt: 0.05, expected: 11 },
    { direction: -1 as const, start: 10, speed: 20, dt: 0.05, expected: 9 },
  ])(
    '按 $direction 方向使用 delta time 推进',
    ({ direction, start, speed, dt, expected }) => {
      const vehicle = createVehicle(track, 'police', start, speed, direction)

      expect(advanceVehicle(track, vehicle, dt).trackPosition).toBeCloseTo(expected, 8)
    },
  )

  it('正反方向都能跨越 trackPosition=0', () => {
    const forward = advanceVehicle(
      track,
      createVehicle(track, 'thief', track.length - 0.5, 20, 1),
      0.05,
    )
    const backward = advanceVehicle(
      track,
      createVehicle(track, 'thief', 0.5, 20, -1),
      0.05,
    )

    expect(forward.trackPosition).toBeCloseTo(0.5, 8)
    expect(backward.trackPosition).toBeCloseTo(track.length - 0.5, 8)
  })

  it('把异常大的 dt 限制为 0.1 秒', () => {
    const vehicle = createVehicle(track, 'police', 20, 50, 1)

    expect(MAX_DELTA_SECONDS).toBe(0.1)
    expect(advanceVehicle(track, vehicle, 30).trackPosition).toBeCloseTo(25, 8)
  })

  it('忽略负数和非有限 dt', () => {
    const vehicle = createVehicle(track, 'police', 20, 50, 1)

    expect(advanceVehicle(track, vehicle, -1).trackPosition).toBe(20)
    expect(advanceVehicle(track, vehicle, Number.NaN).trackPosition).toBe(20)
  })

  it('从道路采样派生世界坐标和反向朝向', () => {
    const forward = createVehicle(track, 'thief', 30, 10, 1)
    const backward = createVehicle(track, 'thief', 30, 10, -1)

    expect(backward.worldPosition).toEqual(forward.worldPosition)
    expect(Math.abs(Math.abs(backward.heading - forward.heading) - Math.PI)).toBeLessThan(1e-8)
  })

  it('掉头只改变方向和朝向，不改变弧长位置或世界坐标', () => {
    const before = createVehicle(track, 'police', 80, 12, 1)
    const after = reverseVehicle(track, before)

    expect(after.direction).toBe(-1)
    expect(after.trackPosition).toBe(before.trackPosition)
    expect(after.worldPosition).toEqual(before.worldPosition)
    expect(Math.abs(Math.abs(after.heading - before.heading) - Math.PI)).toBeLessThan(1e-8)
  })

  it('拒绝负速度', () => {
    expect(() => createVehicle(track, 'thief', 0, -1, 1)).toThrow(/速度/)
  })
})
