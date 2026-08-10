import { describe, expect, it } from 'vitest'

import {
  appendPerformanceSample,
  averageHistoricalPerformance,
  createPerformanceHistory,
} from './performanceHistory'

describe('玩家历史表现', () => {
  it('按样本持续时间计算过去窗口的加权平均值', () => {
    const history = createPerformanceHistory([
      { timestamp: 1, rate: 30 },
      { timestamp: 3, rate: 50 },
    ])

    expect(averageHistoricalPerformance(history, 5, 5)).toBe(40)
  })

  it('追加时拒绝未来、倒序和无效样本', () => {
    const initial = createPerformanceHistory([{ timestamp: 1, rate: 30 }])
    const withPresent = appendPerformanceSample(initial, { timestamp: 2, rate: 50 }, 2)
    const withFuture = appendPerformanceSample(withPresent, { timestamp: 3, rate: 999 }, 2)
    const withPast = appendPerformanceSample(withFuture, { timestamp: 1.5, rate: 999 }, 2)
    const withInvalid = appendPerformanceSample(withPast, { timestamp: 2, rate: Number.NaN }, 2)

    expect(withInvalid.samples).toEqual([
      { timestamp: 1, rate: 30 },
      { timestamp: 2, rate: 50 },
    ])
  })

  it('计算时忽略当前时间之后的样本', () => {
    const history = createPerformanceHistory([
      { timestamp: 0, rate: 30 },
      { timestamp: 2, rate: 50 },
      { timestamp: 6, rate: 999 },
    ])

    expect(averageHistoricalPerformance(history, 5, 5)).toBe(42)
  })

  it('窗口没有有效历史时返回 undefined', () => {
    expect(averageHistoricalPerformance(createPerformanceHistory(), 5, 5)).toBeUndefined()
  })

  it('延迟追加且所有样本都早于保留区间时只保留最后一个 carry-in', () => {
    const history = createPerformanceHistory([
      { timestamp: 0, rate: 10 },
      { timestamp: 1, rate: 20 },
    ])
    const delayed = appendPerformanceSample(
      history,
      { timestamp: 2, rate: 30 },
      10,
    )

    expect(delayed.samples).toEqual([{ timestamp: 2, rate: 30 }])
  })
})
