import { describe, expect, it } from 'vitest'

import {
  createRollingTypingPerformance,
  getRecentPerformance,
  recordCorrectInput,
} from './rollingTypingPerformance'

describe('最近三秒输入表现', () => {
  it.each([
    { rate: 30, duration: 2, count: 5 },
    { rate: 50, duration: 2.4, count: 10 },
    { rate: 80, duration: 1.5, count: 10 },
  ])('英文稳定 $rate WPM', ({ rate, duration, count }) => {
    let state = createRollingTypingPerformance('english', 0)
    state = recordCorrectInput(state, duration, count)
    expect(getRecentPerformance(state, duration).rate).toBeCloseTo(rate, 8)
  })

  it('中文按目标 grapheme 数计算字/分钟', () => {
    let state = createRollingTypingPerformance('chinese', 0)
    state = recordCorrectInput(state, 2.4, 2)
    expect(getRecentPerformance(state, 2.4).rate).toBeCloseTo(50, 8)
  })

  it('高频 burst 被表现率上限约束', () => {
    let state = createRollingTypingPerformance('english', 0)
    state = recordCorrectInput(state, 1, 50)
    expect(getRecentPerformance(state, 1).rate).toBe(140)
  })

  it('查询时淘汰三秒窗口外的旧输入', () => {
    let state = createRollingTypingPerformance('english', 0)
    state = recordCorrectInput(state, 0, 1)
    state = recordCorrectInput(state, 1, 1)
    state = recordCorrectInput(state, 3, 1)
    const snapshot = getRecentPerformance(state, 4.01)

    expect(snapshot.recentCount).toBe(1)
    expect(snapshot.state.correctTimestamps).toEqual([3])
    expect(snapshot.rate).toBeCloseTo(4, 8)
  })

  it('未产生正确输入时表现为零，首个正确输入建立运行起点', () => {
    const ready = createRollingTypingPerformance('english')
    expect(getRecentPerformance(ready, 10).rate).toBe(0)
    const running = recordCorrectInput(ready, 10)
    expect(running.runningStartedAt).toBe(10)
  })

  it('不会提前计算模拟时钟尚未到达的未来输入', () => {
    let state = createRollingTypingPerformance('english', 0)
    state = recordCorrectInput(state, 30, 5)
    const beforeEvent = getRecentPerformance(state, 0.1)

    expect(beforeEvent.recentCount).toBe(0)
    expect(beforeEvent.rate).toBe(0)
  })
})
