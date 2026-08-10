import { useEffect, useRef, useState, type CompositionEvent, type FormEvent, type RefObject } from 'react'

import { createTypingAudio, type TypingAudio } from '../audio'
import { createAiController, stepAiController, type AiControllerState } from '../game/ai'
import { createPlayCamera, updatePlayCamera, type FollowCameraMode } from '../game/camera'
import { advancePursuitFrame, createDebugPursuit, type PursuitFrameState } from '../game/engine'
import {
  PLAYER_THIEF,
  type GameSessionState,
} from '../game/gameSession'
import { finalizeGameplayStep, prepareGameplayStep } from '../game/gameplay'
import { appendPerformanceSample, createPerformanceHistory, type PerformanceHistory } from '../game/performanceHistory'
import { getCanvasResolution } from '../game/projection'
import { getPoliceCatchGap } from '../game/pursuit'
import { renderDebugScene } from '../game/renderDebugScene'
import { createRoundStats, finalizeRoundStats, recordRoundMotion, computeAccuracy, type RoundStatsState } from '../game/roundStats'
import { getRecentPerformance, type RollingTypingPerformance } from '../game/rollingTypingPerformance'
import { computePlayerTargetSpeed, smoothPlayerSpeed, type PlayerSpeedSnapshot } from '../game/speedModel'
import { createDefaultTrack } from '../game/track'
import type { PursuitState } from '../game/types'
import {
  clearImeSuppression,
  consumeImeFallback,
  createImeInputState,
  reduceImeInput,
  shouldBlockBrowserInputType,
  type ImeInputResult,
  type ImeInputState,
  type TypingSessionState,
} from '../input'
import type { GameResult, ResolvedRound } from './types'
import { applyRoundCommittedText, createRoundInputRuntime } from './roundRuntime'

const GAME_TRACK = createDefaultTrack()
const GAME_PURSUIT = createDebugPursuit(GAME_TRACK)

export interface GameRoundHud {
  readonly performanceRate: number
  readonly actualSpeed: number
  readonly targetSpeed: number
  readonly combo: number
  readonly errors: number
  readonly idle: boolean
  readonly accuracy: number
  readonly pursuitDistance: number
}

export interface UseGameRoundResult {
  readonly canvasRef: RefObject<HTMLCanvasElement | null>
  readonly inputRef: RefObject<HTMLTextAreaElement | null>
  readonly typing: TypingSessionState
  readonly session: GameSessionState
  readonly hud: GameRoundHud
  readonly errorPulse: boolean
  readonly handleInput: (event: FormEvent<HTMLTextAreaElement>) => void
  readonly handleBeforeInput: (event: FormEvent<HTMLTextAreaElement>) => void
  readonly handleCompositionStart: () => void
  readonly handleCompositionUpdate: (event: CompositionEvent<HTMLTextAreaElement>) => void
  readonly handleCompositionEnd: (event: CompositionEvent<HTMLTextAreaElement>) => void
}

function initialPursuit(): PursuitState {
  return {
    ...GAME_PURSUIT.state,
    police: { ...GAME_PURSUIT.state.police, speed: 0 },
    thief: { ...GAME_PURSUIT.state.thief, speed: 0 },
  }
}

function seedForRound(round: ResolvedRound): number {
  let seed = 0x811c9dc5 ^ round.id
  for (const character of round.article.id) seed = Math.imul(seed ^ character.charCodeAt(0), 0x01000193)
  return seed >>> 0
}

export function useGameRound(
  round: ResolvedRound,
  onComplete: (result: GameResult) => void,
): UseGameRoundResult {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialRuntime = createRoundInputRuntime(round.article.text, round.settings)
  const initialTyping = initialRuntime.typing
  const initialSession = initialRuntime.session
  const initialAi = createAiController(round.settings.difficulty, seedForRound(round), 0, GAME_TRACK.length)
  const [typing, setTyping] = useState(initialTyping)
  const [session, setSession] = useState(initialSession)
  const [errorPulse, setErrorPulse] = useState(false)
  const [hud, setHud] = useState<GameRoundHud>({
    performanceRate: 0, actualSpeed: 0, targetSpeed: 0, combo: 0, errors: 0, idle: true, accuracy: 1,
    pursuitDistance: getPoliceCatchGap(
      GAME_PURSUIT.state.police.trackPosition,
      GAME_PURSUIT.state.thief.trackPosition,
      GAME_PURSUIT.state.police.direction,
      GAME_TRACK.length,
    ),
  })
  const typingRef = useRef(initialTyping)
  const sessionRef = useRef(initialSession)
  const imeRef = useRef<ImeInputState>(createImeInputState())
  const performanceRef = useRef<RollingTypingPerformance>(initialRuntime.performance)
  const historyRef = useRef<PerformanceHistory>(createPerformanceHistory())
  const aiRef = useRef<AiControllerState>(initialAi)
  const speedRef = useRef<PlayerSpeedSnapshot>(computePlayerTargetSpeed({ trackLength: GAME_TRACK.length, performanceRate: 0, combo: 0, now: 0 }))
  const actualSpeedRef = useRef(0)
  const statsRef = useRef<RoundStatsState>(createRoundStats())
  const simulationTimeRef = useRef(0)
  const resultDeliveredRef = useRef(false)
  const audioRef = useRef<TypingAudio>(createTypingAudio())
  const completeRef = useRef(onComplete)
  const errorTimerRef = useRef<number | undefined>(undefined)
  completeRef.current = onComplete

  const commitText = (text: string) => {
    const result = applyRoundCommittedText({
      typing: typingRef.current,
      session: sessionRef.current,
      performance: performanceRef.current,
    }, text, simulationTimeRef.current)
    if (result.correctCount === 0 && !result.hasError) return
    typingRef.current = result.state.typing
    sessionRef.current = result.state.session
    performanceRef.current = result.state.performance
    setTyping(result.state.typing)
    if (result.correctCount > 0) {
      audioRef.current.play('correct', round.settings)
      if (result.started) {
        setSession(sessionRef.current)
      }
    }
    if (result.hasError) {
      audioRef.current.play('error', round.settings)
      setErrorPulse(true)
      if (errorTimerRef.current !== undefined) window.clearTimeout(errorTimerRef.current)
      errorTimerRef.current = window.setTimeout(() => setErrorPulse(false), 170)
    }
  }

  const consumeIme = (result: ImeInputResult) => {
    imeRef.current = result.state
    if (result.committedText !== undefined) commitText(result.committedText)
    if (result.releaseSuppression === true) queueMicrotask(() => {
      imeRef.current = clearImeSuppression(imeRef.current)
    })
  }

  useEffect(() => {
    const audio = audioRef.current
    inputRef.current?.focus()
    return () => {
      if (errorTimerRef.current !== undefined) window.clearTimeout(errorTimerRef.current)
      audio.dispose()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (canvas === null || canvas === undefined || context === null || context === undefined) return undefined
    let frame: PursuitFrameState = { state: initialPursuit(), accumulatorSeconds: 0 }
    let animationFrame = 0
    let previousTimestamp: number | undefined
    let lastHudAt = 0
    const mode: FollowCameraMode = round.settings.playerRole === PLAYER_THIEF ? 'followThief' : 'followPolice'
    let camera = createPlayCamera(GAME_TRACK, frame.state, mode, { width: 960, height: 600 })

    const renderFrame = (milliseconds: number) => {
      const seconds = milliseconds / 1000
      const rectangle = canvas.getBoundingClientRect()
      const resolution = getCanvasResolution(
        Math.max(1, rectangle.width || 960),
        Math.max(1, rectangle.height || 600),
        window.devicePixelRatio || 1,
      )
      if (canvas.width !== resolution.pixelWidth || canvas.height !== resolution.pixelHeight) {
        canvas.width = resolution.pixelWidth
        canvas.height = resolution.pixelHeight
      }
      const delta = previousTimestamp === undefined ? 0 : seconds - previousTimestamp
      previousTimestamp = seconds

      if (sessionRef.current.phase === 'running') {
        frame = advancePursuitFrame(
          GAME_TRACK,
          frame,
          delta,
          GAME_PURSUIT.config,
          (state, stepSeconds) => {
            simulationTimeRef.current += stepSeconds
            const recent = getRecentPerformance(performanceRef.current, simulationTimeRef.current)
            performanceRef.current = recent.state
            historyRef.current = appendPerformanceSample(historyRef.current, {
              timestamp: simulationTimeRef.current,
              rate: recent.rate,
            }, simulationTimeRef.current)
            speedRef.current = computePlayerTargetSpeed({
              trackLength: GAME_TRACK.length,
              performanceRate: recent.rate,
              combo: typingRef.current.combo,
              now: simulationTimeRef.current,
              lastCorrectAt: typingRef.current.lastCorrectAt,
              lastErrorAt: typingRef.current.lastErrorAt,
            })
            actualSpeedRef.current = smoothPlayerSpeed(
              actualSpeedRef.current,
              speedRef.current.targetSpeed,
              stepSeconds,
            )
            statsRef.current = recordRoundMotion(statsRef.current, actualSpeedRef.current, stepSeconds)
            aiRef.current = stepAiController(aiRef.current, {
              now: simulationTimeRef.current,
              deltaSeconds: stepSeconds,
              trackLength: GAME_TRACK.length,
              playerHistory: historyRef.current,
            })
            return prepareGameplayStep(
              state,
              round.settings.playerRole,
              actualSpeedRef.current,
              aiRef.current.currentSpeed,
            )
          },
          (state) => {
            const resolutionResult = finalizeGameplayStep(sessionRef.current, state, typingRef.current.completed)
            if (resolutionResult.session !== sessionRef.current) {
              sessionRef.current = resolutionResult.session
              setSession(resolutionResult.session)
            }
            if (resolutionResult.terminal && !resultDeliveredRef.current) {
              resultDeliveredRef.current = true
              const stats = finalizeRoundStats(
                statsRef.current,
                typingRef.current.correctCount,
                typingRef.current.errorCount,
              )
              completeRef.current({
                outcome: resolutionResult.session.phase === 'won' ? 'won' : 'lost',
                ...stats,
                article: round.article,
                settings: round.settings,
              })
            }
            return resolutionResult.terminal
          },
        )
      }

      camera = updatePlayCamera(camera, GAME_TRACK, frame.state, mode, resolution.viewport, delta)
      renderDebugScene(context, GAME_TRACK, frame.state, resolution.viewport, {
        camera,
        mode,
        pixelRatio: resolution.pixelRatio,
      })
      if (milliseconds - lastHudAt >= 100) {
        setHud({
          performanceRate: speedRef.current.performanceRate,
          actualSpeed: actualSpeedRef.current,
          targetSpeed: speedRef.current.targetSpeed,
          combo: typingRef.current.combo,
          errors: typingRef.current.errorCount,
          idle: speedRef.current.idle,
          accuracy: computeAccuracy(typingRef.current.correctCount, typingRef.current.errorCount),
          pursuitDistance: getPoliceCatchGap(
            frame.state.police.trackPosition,
            frame.state.thief.trackPosition,
            frame.state.police.direction,
            GAME_TRACK.length,
          ),
        })
        lastHudAt = milliseconds
      }
      animationFrame = window.requestAnimationFrame(renderFrame)
    }
    animationFrame = window.requestAnimationFrame(renderFrame)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [round])

  const handleInput = (event: FormEvent<HTMLTextAreaElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent
    const result = reduceImeInput(imeRef.current, {
      type: 'input',
      text: event.currentTarget.value,
      isComposing: nativeEvent.isComposing,
    })
    consumeIme(result)
    if (result.committedText !== undefined) event.currentTarget.value = ''
  }
  const handleBeforeInput = (event: FormEvent<HTMLTextAreaElement>) => {
    const inputType = (event.nativeEvent as InputEvent).inputType
    if (shouldBlockBrowserInputType(inputType)) event.preventDefault()
  }
  const handleCompositionStart = () => {
    imeRef.current = reduceImeInput(imeRef.current, { type: 'compositionstart' }).state
  }
  const handleCompositionUpdate = (event: CompositionEvent<HTMLTextAreaElement>) => {
    imeRef.current = reduceImeInput(imeRef.current, { type: 'compositionupdate', text: event.data }).state
  }
  const handleCompositionEnd = (event: CompositionEvent<HTMLTextAreaElement>) => {
    const result = reduceImeInput(imeRef.current, { type: 'compositionend', text: event.data })
    imeRef.current = result.state
    if (result.fallbackVersion === undefined) return
    const fallbackVersion = result.fallbackVersion
    queueMicrotask(() => {
      const fallback = consumeImeFallback(imeRef.current, fallbackVersion)
      consumeIme(fallback)
      if (fallback.committedText !== undefined && inputRef.current !== null) inputRef.current.value = ''
      if (fallback.committedText !== undefined) window.setTimeout(() => {
        imeRef.current = clearImeSuppression(imeRef.current)
      }, 0)
    })
  }

  return {
    canvasRef,
    inputRef,
    typing,
    session,
    hud,
    errorPulse,
    handleInput,
    handleBeforeInput,
    handleCompositionStart,
    handleCompositionUpdate,
    handleCompositionEnd,
  }
}
