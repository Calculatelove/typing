import { describe, expect, it } from 'vitest'

import { mod } from './math'
import {
  createClosedTrack,
  createDefaultTrack,
  sampleTrackAt,
  validateSampledRoadSpacing,
} from './track'
import type { TrackSample } from './types'

describe('mod', () => {
  it('把负数和超出一圈的值安全规范到正区间', () => {
    expect(mod(-3, 10)).toBe(7)
    expect(mod(23, 10)).toBe(3)
  })
})

describe('闭合道路', () => {
  it('在 0、整圈和负整圈处返回连续位置及朝向', () => {
    const track = createDefaultTrack()
    const start = sampleTrackAt(track, 0)
    const end = sampleTrackAt(track, track.length)
    const beforeStart = sampleTrackAt(track, -track.length)

    expect(end.position.x).toBeCloseTo(start.position.x, 8)
    expect(end.position.y).toBeCloseTo(start.position.y, 8)
    expect(end.heading).toBeCloseTo(start.heading, 8)
    expect(beforeStart.position.x).toBeCloseTo(start.position.x, 8)
    expect(beforeStart.position.y).toBeCloseTo(start.position.y, 8)
  })

  it('按累计弧长采样而不是按控制点索引采样', () => {
    const track = createClosedTrack([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 340, y: 80 },
      { x: 80, y: 220 },
      { x: -80, y: 80 },
    ])
    const quarter = sampleTrackAt(track, track.length / 4)
    const next = sampleTrackAt(track, track.length / 4 + 1)
    const step = Math.hypot(
      next.position.x - quarter.position.x,
      next.position.y - quarter.position.y,
    )

    expect(step).toBeGreaterThan(0.8)
    expect(step).toBeLessThan(1.2)
  })

  it('返回单位切线、单位法线和匹配的朝向', () => {
    const track = createDefaultTrack()
    const sample = sampleTrackAt(track, track.length * 0.37)

    expect(Math.hypot(sample.tangent.x, sample.tangent.y)).toBeCloseTo(1, 8)
    expect(Math.hypot(sample.normal.x, sample.normal.y)).toBeCloseTo(1, 8)
    expect(sample.tangent.x * sample.normal.x + sample.tangent.y * sample.normal.y)
      .toBeCloseTo(0, 8)
    expect(sample.heading).toBeCloseTo(
      Math.atan2(sample.tangent.y, sample.tangent.x),
      8,
    )
  })

  it('默认路线具有明显不规则曲率而非简单圆形或椭圆', () => {
    const track = createDefaultTrack()
    const centerX = (track.bounds.minX + track.bounds.maxX) / 2
    const centerY = (track.bounds.minY + track.bounds.maxY) / 2
    const radii = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map(
      (ratio) => {
        const point = sampleTrackAt(track, track.length * ratio).position
        return Math.hypot(point.x - centerX, point.y - centerY)
      },
    )

    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(180)
    expect(track.controlPoints.length).toBeGreaterThanOrEqual(10)
    expect(track.samples.length).toBeGreaterThan(500)
  })

  it('拒绝包含过尖折返的控制点', () => {
    expect(() =>
      createClosedTrack([
        { x: -200, y: -100 },
        { x: 200, y: -100 },
        { x: -190, y: -80 },
        { x: 180, y: 120 },
        { x: -200, y: 150 },
      ]),
    ).toThrow(/转角/)
  })

  it('拒绝发生道路自交的控制点', () => {
    expect(() =>
      createClosedTrack([
        { x: -160, y: -120 },
        { x: 160, y: 120 },
        { x: -160, y: 120 },
        { x: 160, y: -120 },
      ]),
    ).toThrow(/自交/)
  })

  it('拒绝不相邻路段间距小于路面安全宽度的道路', () => {
    expect(() =>
      createClosedTrack(
        [
          { x: -180, y: -35 },
          { x: 180, y: -35 },
          { x: 180, y: 35 },
          { x: -180, y: 35 },
        ],
        { roadWidth: 100 },
      ),
    ).toThrow(/间距/)
  })

  it('按折线段中部的最短距离检查错位的长路段', () => {
    const sample = (distance: number, x: number, y: number): TrackSample => ({
      distance,
      position: { x, y },
      tangent: { x: 1, y: 0 },
      normal: { x: 0, y: 1 },
      heading: 0,
    })
    const staggeredParallelSegments = [
      sample(0, 0, 0),
      sample(100, 100, 0),
      sample(300, 50, 4),
      sample(400, 150, 4),
      sample(600, 0, 0),
    ]

    expect(() =>
      validateSampledRoadSpacing(staggeredParallelSegments, 600, 10),
    ).toThrow(/间距/)
  })

  it('用显式 seed 生成可复现且与规则分离的装饰描述', () => {
    const controlPoints = [
      { x: -200, y: -140 },
      { x: 220, y: -120 },
      { x: 240, y: 180 },
      { x: -230, y: 190 },
    ]
    const first = createClosedTrack(controlPoints, { decorationSeed: 42 })
    const again = createClosedTrack(controlPoints, { decorationSeed: 42 })
    const different = createClosedTrack(controlPoints, { decorationSeed: 43 })

    expect(first.decorationSeed).toBe(42)
    expect(first.decorations.length).toBeGreaterThan(20)
    expect(first.decorations).toEqual(again.decorations)
    expect(first.decorations).not.toEqual(different.decorations)
    expect(first.decorations.every((decoration) =>
      Number.isFinite(decoration.position.x) && Number.isFinite(decoration.position.y),
    )).toBe(true)
  })

  it('拒绝无法构成闭合样条的控制点和无效道路宽度', () => {
    expect(() =>
      createClosedTrack([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ]),
    ).toThrow(/至少需要 4 个/)
    expect(() =>
      createClosedTrack(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        { roadWidth: 0 },
      ),
    ).toThrow(/道路宽度/)
  })
})
