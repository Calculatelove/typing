import { describe, expect, it } from 'vitest'

import {
  computeAccuracy,
  createRoundStats,
  finalizeRoundStats,
  recordRoundMotion,
} from './roundStats'

describe('本局结果统计', () => {
  it('按正确和错误事件计算 accuracy', () => {
    expect(computeAccuracy(0, 0)).toBe(1)
    expect(computeAccuracy(9, 1)).toBe(0.9)
  })

  it('按运行时间积分计算玩家平均实际速度', () => {
    const afterFast = recordRoundMotion(createRoundStats(), 120, 2)
    const afterSlow = recordRoundMotion(afterFast, 60, 1)
    expect(finalizeRoundStats(afterSlow, 9, 1)).toEqual({
      averageSpeed: 100,
      accuracy: 0.9,
      correct: 9,
      errors: 1,
      completionSeconds: 3,
    })
  })

  it('忽略非法输入且零时长得到零平均速度', () => {
    const state = recordRoundMotion(createRoundStats(), Number.NaN, -1)
    expect(finalizeRoundStats(state, -1, Number.NaN).averageSpeed).toBe(0)
  })
})
