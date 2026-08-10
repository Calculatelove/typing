export type TypingSoundKind = 'correct' | 'error'

export interface TypingAudioSettings {
  readonly keySoundEnabled: boolean
  readonly errorSoundEnabled: boolean
}

export interface TonePlan {
  readonly frequencyHz: number
  readonly gain: number
  readonly durationSeconds: number
  readonly oscillatorType: OscillatorType
}

export const TONE_PLANS: Readonly<Record<TypingSoundKind, TonePlan>> = {
  correct: { frequencyHz: 720, gain: 0.025, durationSeconds: 0.055, oscillatorType: 'sine' },
  error: { frequencyHz: 180, gain: 0.04, durationSeconds: 0.04, oscillatorType: 'triangle' },
}

interface AudioParameterLike {
  setValueAtTime(value: number, time: number): unknown
  exponentialRampToValueAtTime(value: number, endTime: number): unknown
}

interface AudioNodeLike {
  connect(destination: unknown): unknown
}

export interface AudioContextLike {
  readonly currentTime: number
  readonly destination: unknown
  readonly state: string
  createOscillator(): AudioNodeLike & {
    frequency: AudioParameterLike
    type: OscillatorType
    start(time?: number): void
    stop(time?: number): void
  }
  createGain(): AudioNodeLike & { gain: AudioParameterLike }
  resume(): Promise<void> | void
  close?(): Promise<void> | void
}

export interface TypingAudio {
  play(kind: TypingSoundKind, settings: TypingAudioSettings): void
  dispose(): void
}

function browserAudioContextFactory(): AudioContextLike {
  const Constructor = window.AudioContext
  return new Constructor()
}

export function createTypingAudio(
  contextFactory: () => AudioContextLike = browserAudioContextFactory,
): TypingAudio {
  let context: AudioContextLike | undefined
  return {
    play(kind, settings) {
      const enabled = kind === 'correct' ? settings.keySoundEnabled : settings.errorSoundEnabled
      if (!enabled) return
      try {
        context ??= contextFactory()
        if (context.state === 'suspended') void context.resume()
        const plan = TONE_PLANS[kind]
        const now = context.currentTime
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        oscillator.type = plan.oscillatorType
        oscillator.frequency.setValueAtTime(plan.frequencyHz, now)
        gain.gain.setValueAtTime(plan.gain, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + plan.durationSeconds)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(now)
        oscillator.stop(now + plan.durationSeconds)
      } catch {
        // 浏览器策略、隐私模式或硬件错误都不应阻断游戏输入。
      }
    },
    dispose() {
      try {
        void context?.close?.()
      } catch {
        // 释放失败不应影响页面卸载。
      }
      context = undefined
    },
  }
}
