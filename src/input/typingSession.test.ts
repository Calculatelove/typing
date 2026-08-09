import { describe, expect, it } from 'vitest'

import { applyCommittedText, createTypingSession } from './typingSession'

describe('正式输入判定', () => {
  it('逐 grapheme 接受正确输入并记录连击与时间戳', () => {
    const result = applyCommittedText(createTypingSession('type'), 'ty', 1.25)

    expect(result.state.correctIndex).toBe(2)
    expect(result.state.correctCount).toBe(2)
    expect(result.state.errorCount).toBe(0)
    expect(result.state.combo).toBe(2)
    expect(result.state.lastCorrectAt).toBe(1.25)
    expect(result.state.correctTimestamps).toEqual([1.25, 1.25])
    expect(result.events.map((event) => event.type)).toEqual(['correct', 'correct'])
  })

  it('中文批量提交保留正确前缀并在首个错误处停止', () => {
    const result = applyCommittedText(createTypingSession('中文输入'), '中文错余', 2)

    expect(result.state.correctIndex).toBe(2)
    expect(result.state.correctCount).toBe(2)
    expect(result.state.errorCount).toBe(1)
    expect(result.state.combo).toBe(0)
    expect(result.state.lastErrorAt).toBe(2)
    expect(result.events.map((event) => event.type)).toEqual(['correct', 'correct', 'error'])
  })

  it('错误不推进，重新输入正确内容后才完成', () => {
    const wrong = applyCommittedText(createTypingSession('好'), '坏', 3)
    const corrected = applyCommittedText(wrong.state, '好', 3.2)

    expect(wrong.state.correctIndex).toBe(0)
    expect(corrected.state.correctIndex).toBe(1)
    expect(corrected.state.completed).toBe(true)
    expect(corrected.events.map((event) => event.type)).toEqual(['correct', 'completed'])
  })

  it('明显空闲后的首个正确输入从新连击 1 开始', () => {
    const first = applyCommittedText(createTypingSession('abc'), 'a', 0)
    const resumed = applyCommittedText(first.state, 'b', 2, { comboResetAfterSeconds: 0.75 })

    expect(first.state.combo).toBe(1)
    expect(resumed.state.combo).toBe(1)
  })
})
