import { describe, expect, it } from 'vitest'

import { createDefaultTrack } from './track'
import { createWorldPursuitConfig } from './worldConfig'

describe('世界配置', () => {
  it('路线变长但道路宽度不变时抓捕距离保持不变', () => {
    const short = createWorldPursuitConfig({ length: 5000, roadWidth: 120 })
    const long = createWorldPursuitConfig({ length: 12000, roadWidth: 120 })

    expect(short.catchDistance).toBe(64.8)
    expect(long.catchDistance).toBe(short.catchDistance)
    expect(long.reverseThreshold).toBeGreaterThan(short.reverseThreshold)
    expect(long.reverseThreshold).toBeGreaterThanOrEqual(long.catchDistance * 5)
  })

  it('道路加宽时按独立世界单位调整抓捕距离', () => {
    const config = createWorldPursuitConfig({ length: 8000, roadWidth: 200 })
    expect(config.catchDistance).toBe(84)
  })

  it('默认地图主要轴向达到多个 Play 视口的量级', () => {
    const track = createDefaultTrack()
    expect(track.bounds.maxX - track.bounds.minX).toBeGreaterThan(2500)
    expect(track.bounds.maxY - track.bounds.minY).toBeGreaterThan(1900)
  })
})
