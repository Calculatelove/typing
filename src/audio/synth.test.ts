import { describe, expect, it, vi } from 'vitest'

import { TONE_PLANS, createTypingAudio, type AudioContextLike } from './synth'

function createContext(): AudioContextLike {
  const parameter = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  return {
    currentTime: 1,
    destination: {},
    state: 'running',
    createOscillator: () => ({
      frequency: parameter,
      type: 'sine',
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createGain: () => ({ gain: parameter, connect: vi.fn() }),
    resume: vi.fn(),
  }
}

describe('Web Audio 合成提示音', () => {
  it('正确音更高更轻，错误音更低更短', () => {
    expect(TONE_PLANS.correct.frequencyHz).toBeGreaterThan(TONE_PLANS.error.frequencyHz)
    expect(TONE_PLANS.correct.gain).toBeLessThan(TONE_PLANS.error.gain)
    expect(TONE_PLANS.error.durationSeconds).toBeLessThan(TONE_PLANS.correct.durationSeconds)
  })

  it('两个开关独立路由且仅首次播放时创建上下文', () => {
    const factory = vi.fn(() => createContext())
    const audio = createTypingAudio(factory)
    audio.play('correct', { keySoundEnabled: false, errorSoundEnabled: true })
    expect(factory).not.toHaveBeenCalled()
    audio.play('error', { keySoundEnabled: false, errorSoundEnabled: true })
    expect(factory).toHaveBeenCalledOnce()
    audio.play('correct', { keySoundEnabled: true, errorSoundEnabled: false })
    expect(factory).toHaveBeenCalledOnce()
  })

  it('浏览器拒绝音频时静默失败', () => {
    const audio = createTypingAudio(() => { throw new Error('blocked') })
    expect(() => audio.play('correct', { keySoundEnabled: true, errorSoundEnabled: true })).not.toThrow()
  })

  it('本局卸载时释放已创建的音频上下文', () => {
    const context = createContext()
    const close = vi.fn()
    const audio = createTypingAudio(() => ({ ...context, close }))
    audio.play('correct', { keySoundEnabled: true, errorSoundEnabled: true })
    audio.dispose()
    audio.dispose()
    expect(close).toHaveBeenCalledOnce()
  })
})
