export interface TypingSessionState {
  readonly targetGraphemes: readonly string[]
  readonly correctIndex: number
  readonly correctCount: number
  readonly errorCount: number
  readonly combo: number
  readonly lastCorrectAt?: number
  readonly lastErrorAt?: number
  readonly correctTimestamps: readonly number[]
  readonly completed: boolean
}

export type TypingEventType = 'correct' | 'error' | 'completed'

export interface TypingEvent {
  readonly type: TypingEventType
  readonly timestamp: number
  readonly grapheme?: string
}

export interface TypingCommitResult {
  readonly state: TypingSessionState
  readonly events: readonly TypingEvent[]
}

export interface TypingCommitOptions {
  readonly comboResetAfterSeconds?: number
}

export function createTypingSession(targetText: string): TypingSessionState {
  return {
    targetGraphemes: segmentGraphemes(targetText),
    correctIndex: 0,
    correctCount: 0,
    errorCount: 0,
    combo: 0,
    correctTimestamps: [],
    completed: false,
  }
}

export function applyCommittedText(
  state: TypingSessionState,
  text: string,
  timestamp: number,
  options: TypingCommitOptions = {},
): TypingCommitResult {
  if (state.completed || !Number.isFinite(timestamp)) return { state, events: [] }
  const events: TypingEvent[] = []
  let correctIndex = state.correctIndex
  let correctCount = state.correctCount
  let errorCount = state.errorCount
  const comboResetAfterSeconds = options.comboResetAfterSeconds
  const resetCombo = comboResetAfterSeconds !== undefined
    && Number.isFinite(comboResetAfterSeconds)
    && comboResetAfterSeconds >= 0
    && state.lastCorrectAt !== undefined
    && timestamp - state.lastCorrectAt > comboResetAfterSeconds
  let combo = resetCombo ? 0 : state.combo
  let lastCorrectAt = state.lastCorrectAt
  let lastErrorAt = state.lastErrorAt
  const correctTimestamps = [...state.correctTimestamps]

  for (const grapheme of segmentGraphemes(text)) {
    if (grapheme !== state.targetGraphemes[correctIndex]) {
      errorCount += 1
      combo = 0
      lastErrorAt = timestamp
      events.push({ type: 'error', timestamp, grapheme })
      break
    }
    correctIndex += 1
    correctCount += 1
    combo += 1
    lastCorrectAt = timestamp
    correctTimestamps.push(timestamp)
    events.push({ type: 'correct', timestamp, grapheme })
    if (correctIndex === state.targetGraphemes.length) {
      events.push({ type: 'completed', timestamp })
      break
    }
  }

  return {
    state: {
      ...state,
      correctIndex,
      correctCount,
      errorCount,
      combo,
      lastCorrectAt,
      lastErrorAt,
      correctTimestamps,
      completed: correctIndex === state.targetGraphemes.length,
    },
    events,
  }
}
import { segmentGraphemes } from './graphemes'
