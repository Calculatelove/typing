import { describe, expect, it } from 'vitest'

import {
  FIXED_STEP_SECONDS,
  advancePursuitFrame,
  createDebugPursuit,
} from './engine'
import { getThiefLead } from './pursuit'
import { createDefaultTrack } from './track'
import { smoothPlayerSpeed } from './speedModel'

describe('固定时间步追逐引擎', () => {
  it('创建不会立即抓捕或立即掉头的调试世界', () => {
    const track = createDefaultTrack()
    const debug = createDebugPursuit(track)
    const lead = getThiefLead(
      debug.state.police.trackPosition,
      debug.state.thief.trackPosition,
      debug.state.police.direction,
      track.length,
    )

    expect(lead).toBeGreaterThan(debug.config.catchDistance)
    expect(lead).toBeLessThan(track.length - debug.config.reverseThreshold)
    expect(debug.state.police.speed).toBeCloseTo(track.length / 30, 8)
    expect(debug.state.thief.speed).toBeCloseTo(track.length / 12, 8)
  })

  it('累计不足一固定步的时间且在达到 1/60 秒时推进', () => {
    const track = createDefaultTrack()
    const debug = createDebugPursuit(track)
    const half = advancePursuitFrame(
      track,
      { state: debug.state, accumulatorSeconds: 0 },
      FIXED_STEP_SECONDS / 2,
      debug.config,
    )
    const full = advancePursuitFrame(
      track,
      half,
      FIXED_STEP_SECONDS / 2,
      debug.config,
    )

    expect(half.state.police.trackPosition).toBe(debug.state.police.trackPosition)
    expect(full.state.police.trackPosition).toBeGreaterThan(debug.state.police.trackPosition)
    expect(full.accumulatorSeconds).toBeCloseTo(0, 10)
  })

  it('丢弃后台恢复产生的超长帧积压', () => {
    const track = createDefaultTrack()
    const debug = createDebugPursuit(track)
    const next = advancePursuitFrame(
      track,
      { state: debug.state, accumulatorSeconds: 0 },
      30,
      debug.config,
    )

    expect(next.state.police.trackPosition).toBeCloseTo(
      debug.state.police.trackPosition + debug.state.police.speed * debug.config.maxDeltaSeconds,
      7,
    )
  })

  it('玩家速度在固定步内更新时不同渲染 FPS 的位置一致', () => {
    const track = createDefaultTrack()
    const debug = createDebugPursuit(track)
    const simulate = (fps: number) => {
      let actualSpeed = 0
      let frame = {
        state: {
          ...debug.state,
          police: { ...debug.state.police, speed: 0 },
          thief: { ...debug.state.thief, speed: 0 },
        },
        accumulatorSeconds: 0,
      }
      for (let index = 0; index < fps; index += 1) {
        frame = advancePursuitFrame(track, frame, 1 / fps, debug.config, (state, stepSeconds) => {
          actualSpeed = smoothPlayerSpeed(actualSpeed, 240, stepSeconds)
          return { ...state, thief: { ...state.thief, speed: actualSpeed } }
        })
      }
      return { actualSpeed, position: frame.state.thief.trackPosition }
    }

    const at30 = simulate(30)
    const at60 = simulate(60)
    const at144 = simulate(144)
    expect(at30.actualSpeed).toBeGreaterThan(230)
    expect(at60.actualSpeed).toBeCloseTo(at30.actualSpeed, 8)
    expect(at144.actualSpeed).toBeCloseTo(at30.actualSpeed, 8)
    expect(at60.position).toBeCloseTo(at30.position, 8)
    expect(at144.position).toBeCloseTo(at30.position, 8)
  })

  it('终局回调在固定步结束后立即停止同一渲染帧的剩余补算', () => {
    const track = createDefaultTrack()
    const debug = createDebugPursuit(track)
    const oneStep = advancePursuitFrame(
      track,
      { state: debug.state, accumulatorSeconds: 0 },
      FIXED_STEP_SECONDS,
      debug.config,
    )
    let resolvedSteps = 0
    const stopped = advancePursuitFrame(
      track,
      { state: debug.state, accumulatorSeconds: 0 },
      FIXED_STEP_SECONDS * 4,
      debug.config,
      undefined,
      () => {
        resolvedSteps += 1
        return true
      },
    )

    expect(resolvedSteps).toBe(1)
    expect(stopped.state.police.trackPosition).toBeCloseTo(
      oneStep.state.police.trackPosition,
      8,
    )
    expect(stopped.accumulatorSeconds).toBe(0)
  })
})
