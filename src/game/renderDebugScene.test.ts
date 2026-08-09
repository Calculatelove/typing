import { describe, expect, it } from 'vitest'
import { shouldRenderDecorationNearFocus } from './renderDebugScene'
import type { PursuitState, TrackDecoration } from './types'

const state: PursuitState = {
  police: {
    role: 'police',
    trackPosition: 0,
    speed: 0,
    direction: 1,
    worldPosition: { x: 1_000, y: 1_000 },
    heading: 0,
  },
  thief: {
    role: 'thief',
    trackPosition: 0,
    speed: 0,
    direction: 1,
    worldPosition: { x: 100, y: 100 },
    heading: 0,
  },
  captured: false,
  reverseArmed: true,
  reverseCooldownRemaining: 0,
  reverseCount: 0,
}

function buildingAt(x: number, y: number): TrackDecoration {
  return { id: 'building', kind: 'building', position: { x, y }, heading: 0, variant: 0, scale: 1 }
}

describe('跟随视图建筑净空', () => {
  it('只在 Play 模式隐藏跟随目标附近的建筑', () => {
    const nearby = buildingAt(250, 100)
    const farAway = buildingAt(600, 100)

    expect(shouldRenderDecorationNearFocus(nearby, state, 'followThief', 120)).toBe(false)
    expect(shouldRenderDecorationNearFocus(farAway, state, 'followThief', 120)).toBe(true)
    expect(shouldRenderDecorationNearFocus(nearby, state, 'followPolice', 120)).toBe(true)
    expect(shouldRenderDecorationNearFocus(nearby, state, 'overview', 120)).toBe(true)
  })
})
