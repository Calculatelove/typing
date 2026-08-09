import { describe, expect, it } from 'vitest'

import { getPlayCameraTarget, createPlayCamera, updatePlayCamera } from './camera'
import { createDebugPursuit } from './engine'
import { createDefaultTrack } from './track'
import { reverseVehicle } from './vehicle'
import type { PursuitState } from './types'

const viewport = { width: 1200, height: 750 }

describe('Play 摄像机', () => {
  it('前视始终位于玩家当前实际 heading 前方', () => {
    const track = createDefaultTrack()
    const debug = createDebugPursuit(track)
    const target = getPlayCameraTarget(debug.state, 'followThief', viewport, 1)
    const player = debug.state.thief
    const offset = { x: target.x - player.worldPosition.x, y: target.y - player.worldPosition.y }
    expect(offset.x * Math.cos(player.heading) + offset.y * Math.sin(player.heading)).toBeGreaterThan(0)

    const reversedPlayer = reverseVehicle(track, player)
    const reversed = {
      ...debug.state,
      police: reverseVehicle(track, debug.state.police),
      thief: reversedPlayer,
    }
    const reverseTarget = getPlayCameraTarget(reversed, 'followThief', viewport, 1)
    const reverseOffset = {
      x: reverseTarget.x - reversedPlayer.worldPosition.x,
      y: reverseTarget.y - reversedPlayer.worldPosition.y,
    }
    expect(reverseOffset.x * Math.cos(reversedPlayer.heading) + reverseOffset.y * Math.sin(reversedPlayer.heading))
      .toBeGreaterThan(0)
    expect(reverseOffset.x * Math.cos(player.heading) + reverseOffset.y * Math.sin(player.heading))
      .toBeLessThan(0)
  })

  it('指数平滑对时间分片保持一致且 dt=0 不移动', () => {
    const track = createDefaultTrack()
    const debug = createDebugPursuit(track)
    const initial = { ...createPlayCamera(track, debug.state, 'followThief', viewport), position: { x: 0, y: 0 } }
    const once = updatePlayCamera(initial, track, debug.state, 'followThief', viewport, 0.1)
    const half = updatePlayCamera(initial, track, debug.state, 'followThief', viewport, 0.05)
    const twice = updatePlayCamera(half, track, debug.state, 'followThief', viewport, 0.05)
    expect(updatePlayCamera(initial, track, debug.state, 'followThief', viewport, 0)).toEqual(initial)
    expect(twice.position.x).toBeCloseTo(once.position.x, 8)
    expect(twice.position.y).toBeCloseTo(once.position.y, 8)
  })

  it('另一辆车接近时才把目标向双车中点偏移，并支持跟随警察', () => {
    const track = createDefaultTrack()
    const debug = createDebugPursuit(track)
    const base: PursuitState = {
      ...debug.state,
      thief: { ...debug.state.thief, worldPosition: { x: 0, y: 0 }, heading: 0 },
      police: { ...debug.state.police, worldPosition: { x: -5_000, y: 0 }, heading: 0 },
    }
    const far = getPlayCameraTarget(base, 'followThief', viewport, 1)
    const nearState = {
      ...base,
      police: { ...base.police, worldPosition: { x: 200, y: 0 } },
    }
    const near = getPlayCameraTarget(nearState, 'followThief', viewport, 1)
    const police = getPlayCameraTarget(nearState, 'followPolice', viewport, 1)

    expect(near.x).toBeLessThan(far.x)
    expect(near.x).toBeGreaterThan(100)
    expect(police.x).toBeGreaterThan(nearState.police.worldPosition.x)
  })

  it('速度越高时沿实际行驶方向保留更多前视空间', () => {
    const track = createDefaultTrack()
    const debug = createDebugPursuit(track)
    const base: PursuitState = {
      ...debug.state,
      thief: { ...debug.state.thief, speed: 0, worldPosition: { x: 0, y: 0 }, heading: 0 },
      police: { ...debug.state.police, worldPosition: { x: -5_000, y: 0 } },
    }
    const lowSpeed = getPlayCameraTarget(base, 'followThief', viewport, 1)
    const highSpeed = getPlayCameraTarget({
      ...base,
      thief: { ...base.thief, speed: 800 },
    }, 'followThief', viewport, 1)

    expect(highSpeed.x).toBeGreaterThan(lowSpeed.x)
  })
})
