import { describe, expect, it } from 'vitest'

import {
  FIXED_STEP_SECONDS,
  advancePursuitFrame,
  createDebugPursuit,
} from './engine'
import { getThiefLead } from './pursuit'
import { createDefaultTrack } from './track'

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
})
