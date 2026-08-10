import { useEffect, useRef, useState } from 'react'

import {
  createAiController,
  stepAiController,
  type AiControllerState,
  type AiDifficulty,
} from '../game/ai'
import { createPlayCamera, updatePlayCamera, type CameraMode } from '../game/camera'
import {
  advancePursuitFrame,
  createDebugPursuit,
  type PursuitFrameState,
} from '../game/engine'
import { computeSceneOverviewCamera, getCanvasResolution } from '../game/projection'
import {
  PLAYER_POLICE,
  PLAYER_THIEF,
  createGameSession,
  transitionGameSession,
  type GamePhase,
  type GameSessionState,
  type PlayerRole,
} from '../game/gameSession'
import { finalizeGameplayStep, prepareGameplayStep } from '../game/gameplay'
import {
  appendPerformanceSample,
  createPerformanceHistory,
  type PerformanceHistory,
} from '../game/performanceHistory'
import { getThiefLead } from '../game/pursuit'
import { renderDebugScene } from '../game/renderDebugScene'
import {
  createRollingTypingPerformance,
  getRecentPerformance,
  recordCorrectInput,
  type RollingTypingPerformance,
  type TypingLanguage,
} from '../game/rollingTypingPerformance'
import {
  computePlayerTargetSpeed,
  smoothPlayerSpeed,
  type PlayerSpeedSnapshot,
} from '../game/speedModel'
import { PLAYER_SPEED_CONFIG } from '../game/speedConfig'
import { createDefaultTrack } from '../game/track'
import type { PursuitState, Track } from '../game/types'
import {
  applyCommittedText,
  clearImeSuppression,
  consumeImeFallback,
  createImeInputState,
  createTypingSession,
  reduceImeInput,
  shouldBlockBrowserInputType,
  type ImeInputResult,
  type ImeInputState,
  type TypingSessionState,
} from '../input'

const DEBUG_TRACK = createDefaultTrack()
const DEBUG_PURSUIT = createDebugPursuit(DEBUG_TRACK)
const DEBUG_AI_SEED = 0x4a17c9e3
const DEBUG_TEXTS: Readonly<Record<TypingLanguage, string>> = {
  english: 'Electric riders follow the winding city road.',
  chinese: '电动车沿着城市弯道平稳追逐。',
}

const DIFFICULTY_LABELS: Readonly<Record<AiDifficulty, string>> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
  shadow: '影子',
}

interface DebugHud {
  readonly direction: string
  readonly lead: string
  readonly reverseCount: number
  readonly captured: string
}

interface TypingHud {
  readonly performanceRate: number
  readonly targetSpeed: number
  readonly actualSpeed: number
  readonly combo: number
  readonly idle: boolean
  readonly errorPenalty: number
  readonly aiCurrentPerformanceRate: number
  readonly aiTargetPerformanceRate: number
  readonly aiActualSpeed: number
}

const INITIAL_TYPING_HUD: TypingHud = {
  performanceRate: 0,
  targetSpeed: 0,
  actualSpeed: 0,
  combo: 0,
  idle: true,
  errorPenalty: 1,
  aiCurrentPerformanceRate: 0,
  aiTargetPerformanceRate: 0,
  aiActualSpeed: 0,
}

function createReadyGameSession(
  playerRole: PlayerRole,
  difficulty: AiDifficulty,
): GameSessionState {
  return transitionGameSession(
    createGameSession({ playerRole, difficulty }),
    { type: 'prepare' },
  )
}

function phaseLabel(phase: GamePhase): string {
  if (phase === 'setup') return '设置中'
  if (phase === 'ready') return '准备中'
  if (phase === 'running') return '追逐运行中'
  if (phase === 'won') return '玩家胜利'
  return '玩家失败'
}

function createPreviewPursuitState(): PursuitState {
  return {
    ...DEBUG_PURSUIT.state,
    police: { ...DEBUG_PURSUIT.state.police, speed: 0 },
    thief: { ...DEBUG_PURSUIT.state.thief, speed: 0 },
  }
}

function toHud(track: Track, state: PursuitState): DebugHud {
  const lead = getThiefLead(
    state.police.trackPosition,
    state.thief.trackPosition,
    state.police.direction,
    track.length,
  )
  return {
    direction: state.police.direction === 1 ? '正向' : '反向',
    lead: `${lead.toFixed(0)} / ${track.length.toFixed(0)}`,
    reverseCount: state.reverseCount,
    captured: state.captured ? '已抓捕' : '追逐中',
  }
}

function DebugChasePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialSession = createTypingSession(DEBUG_TEXTS.english)
  const initialGameSession = createReadyGameSession(PLAYER_THIEF, 'normal')
  const initialAi = createAiController('normal', DEBUG_AI_SEED, 0, DEBUG_TRACK.length)
  const [hud, setHud] = useState(() => toHud(DEBUG_TRACK, createPreviewPursuitState()))
  const [typingHud, setTypingHud] = useState<TypingHud>({
    ...INITIAL_TYPING_HUD,
    aiCurrentPerformanceRate: initialAi.currentPerformanceRate,
    aiTargetPerformanceRate: initialAi.targetPerformanceRate,
    aiActualSpeed: initialAi.currentSpeed,
  })
  const [typingView, setTypingView] = useState<TypingSessionState>(initialSession)
  const [language, setLanguage] = useState<TypingLanguage>('english')
  const [playerRole, setPlayerRole] = useState<PlayerRole>(PLAYER_THIEF)
  const [difficulty, setDifficulty] = useState<AiDifficulty>('normal')
  const [gameSessionView, setGameSessionView] = useState<GameSessionState>(initialGameSession)
  const [mode, setMode] = useState<CameraMode>('followThief')
  const modeRef = useRef<CameraMode>('followThief')
  const languageRef = useRef<TypingLanguage>('english')
  const playerRoleRef = useRef<PlayerRole>(PLAYER_THIEF)
  const difficultyRef = useRef<AiDifficulty>('normal')
  const gameSessionRef = useRef<GameSessionState>(initialGameSession)
  const typingSessionRef = useRef<TypingSessionState>(initialSession)
  const imeStateRef = useRef<ImeInputState>(createImeInputState())
  const performanceRef = useRef<RollingTypingPerformance>(createRollingTypingPerformance('english'))
  const performanceHistoryRef = useRef<PerformanceHistory>(createPerformanceHistory())
  const aiStateRef = useRef<AiControllerState>(initialAi)
  const speedSnapshotRef = useRef<PlayerSpeedSnapshot>(
    computePlayerTargetSpeed({ trackLength: DEBUG_TRACK.length, performanceRate: 0, combo: 0, now: 0 }),
  )
  const actualSpeedRef = useRef(0)
  const simulationTimestampRef = useRef(0)
  const resetVersionRef = useRef(0)

  const selectMode = (nextMode: CameraMode) => {
    modeRef.current = nextMode
    setMode(nextMode)
  }

  const commitText = (text: string, timestamp: number) => {
    const result = applyCommittedText(typingSessionRef.current, text, timestamp, {
      comboResetAfterSeconds: PLAYER_SPEED_CONFIG.idleDelaySeconds,
    })
    typingSessionRef.current = result.state
    setTypingView(result.state)
    const correctCount = result.events.filter((event) => event.type === 'correct').length
    if (correctCount > 0) {
      performanceRef.current = recordCorrectInput(performanceRef.current, timestamp, correctCount)
      if (gameSessionRef.current.phase === 'ready') {
        const runningSession = transitionGameSession(
          gameSessionRef.current,
          { type: 'firstCorrectInput' },
        )
        gameSessionRef.current = runningSession
        setGameSessionView(runningSession)
        simulationTimestampRef.current = timestamp
      }
    }
  }

  const consumeImeResult = (result: ImeInputResult, timestamp: number) => {
    imeStateRef.current = result.state
    if (result.committedText !== undefined) commitText(result.committedText, timestamp)
    if (result.releaseSuppression === true) {
      queueMicrotask(() => {
        imeStateRef.current = clearImeSuppression(imeStateRef.current)
      })
    }
  }

  const resetRound = (options: {
    readonly language?: TypingLanguage
    readonly playerRole?: PlayerRole
    readonly difficulty?: AiDifficulty
  } = {}) => {
    const nextLanguage = options.language ?? languageRef.current
    const nextPlayerRole = options.playerRole ?? playerRoleRef.current
    const nextDifficulty = options.difficulty ?? difficultyRef.current
    languageRef.current = nextLanguage
    setLanguage(nextLanguage)
    playerRoleRef.current = nextPlayerRole
    setPlayerRole(nextPlayerRole)
    difficultyRef.current = nextDifficulty
    setDifficulty(nextDifficulty)
    const nextGameSession = createReadyGameSession(nextPlayerRole, nextDifficulty)
    gameSessionRef.current = nextGameSession
    setGameSessionView(nextGameSession)
    const nextSession = createTypingSession(DEBUG_TEXTS[nextLanguage])
    typingSessionRef.current = nextSession
    setTypingView(nextSession)
    imeStateRef.current = createImeInputState()
    performanceRef.current = createRollingTypingPerformance(nextLanguage)
    performanceHistoryRef.current = createPerformanceHistory()
    actualSpeedRef.current = 0
    simulationTimestampRef.current = 0
    aiStateRef.current = createAiController(
      nextDifficulty,
      DEBUG_AI_SEED,
      0,
      DEBUG_TRACK.length,
    )
    speedSnapshotRef.current = computePlayerTargetSpeed({
      trackLength: DEBUG_TRACK.length,
      performanceRate: 0,
      combo: 0,
      now: 0,
    })
    setTypingHud({
      ...INITIAL_TYPING_HUD,
      aiCurrentPerformanceRate: aiStateRef.current.currentPerformanceRate,
      aiTargetPerformanceRate: aiStateRef.current.targetPerformanceRate,
      aiActualSpeed: aiStateRef.current.currentSpeed,
    })
    const playerMode: CameraMode = nextPlayerRole === PLAYER_THIEF
      ? 'followThief'
      : 'followPolice'
    selectMode(playerMode)
    setHud(toHud(DEBUG_TRACK, createPreviewPursuitState()))
    resetVersionRef.current += 1
    if (inputRef.current !== null) inputRef.current.value = ''
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  const selectLanguage = (nextLanguage: TypingLanguage) => {
    resetRound({ language: nextLanguage })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (canvas === null || canvas === undefined || context === null || context === undefined) {
      return undefined
    }

    let frame: PursuitFrameState = { state: createPreviewPursuitState(), accumulatorSeconds: 0 }
    let animationFrame = 0
    let previousTimestamp: number | undefined
    let lastHudTimestamp = 0
    let activeMode: CameraMode = 'followThief'
    let observedResetVersion = resetVersionRef.current
    let camera = createPlayCamera(DEBUG_TRACK, frame.state, 'followThief', { width: 960, height: 600 })

    const renderFrame = (timestampMilliseconds: number) => {
      const timestamp = timestampMilliseconds / 1000
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

      const frameDelta = previousTimestamp === undefined ? 0 : timestamp - previousTimestamp
      if (observedResetVersion !== resetVersionRef.current) {
        frame = { state: createPreviewPursuitState(), accumulatorSeconds: 0 }
        observedResetVersion = resetVersionRef.current
        activeMode = modeRef.current
        camera = activeMode === 'overview'
          ? computeSceneOverviewCamera(DEBUG_TRACK, resolution.viewport)
          : createPlayCamera(DEBUG_TRACK, frame.state, activeMode, resolution.viewport)
      }
      previousTimestamp = timestamp

      if (gameSessionRef.current.phase === 'running') {
        frame = advancePursuitFrame(
          DEBUG_TRACK,
          frame,
          frameDelta,
          DEBUG_PURSUIT.config,
          (state, stepSeconds) => {
            simulationTimestampRef.current += stepSeconds
            const recent = getRecentPerformance(
              performanceRef.current,
              simulationTimestampRef.current,
            )
            performanceRef.current = recent.state
            performanceHistoryRef.current = appendPerformanceSample(
              performanceHistoryRef.current,
              {
                timestamp: simulationTimestampRef.current,
                rate: recent.rate,
              },
              simulationTimestampRef.current,
            )
            speedSnapshotRef.current = computePlayerTargetSpeed({
              trackLength: DEBUG_TRACK.length,
              performanceRate: recent.rate,
              combo: typingSessionRef.current.combo,
              now: simulationTimestampRef.current,
              lastCorrectAt: typingSessionRef.current.lastCorrectAt,
              lastErrorAt: typingSessionRef.current.lastErrorAt,
            })
            actualSpeedRef.current = smoothPlayerSpeed(
              actualSpeedRef.current,
              speedSnapshotRef.current.targetSpeed,
              stepSeconds,
            )
            aiStateRef.current = stepAiController(aiStateRef.current, {
              now: simulationTimestampRef.current,
              deltaSeconds: stepSeconds,
              trackLength: DEBUG_TRACK.length,
              playerHistory: performanceHistoryRef.current,
            })
            return prepareGameplayStep(
              state,
              playerRoleRef.current,
              actualSpeedRef.current,
              aiStateRef.current.currentSpeed,
            )
          },
          (state) => {
            const result = finalizeGameplayStep(
              gameSessionRef.current,
              state,
              typingSessionRef.current.completed,
            )
            if (result.session !== gameSessionRef.current) {
              gameSessionRef.current = result.session
              setGameSessionView(result.session)
            }
            return result.terminal
          },
        )
      }

      const requestedMode = modeRef.current
      if (requestedMode !== activeMode) {
        camera = requestedMode === 'overview'
          ? computeSceneOverviewCamera(DEBUG_TRACK, resolution.viewport)
          : activeMode === 'overview'
            ? createPlayCamera(DEBUG_TRACK, frame.state, requestedMode, resolution.viewport)
            : camera
        activeMode = requestedMode
      }
      camera = activeMode === 'overview'
        ? computeSceneOverviewCamera(DEBUG_TRACK, resolution.viewport)
        : updatePlayCamera(camera, DEBUG_TRACK, frame.state, activeMode, resolution.viewport, frameDelta)

      renderDebugScene(context, DEBUG_TRACK, frame.state, resolution.viewport, {
        camera,
        mode: activeMode,
        pixelRatio: resolution.pixelRatio,
      })
      if (timestampMilliseconds - lastHudTimestamp >= 100) {
        setHud(toHud(DEBUG_TRACK, frame.state))
        setTypingHud({
          performanceRate: speedSnapshotRef.current.performanceRate,
          targetSpeed: speedSnapshotRef.current.targetSpeed,
          actualSpeed: actualSpeedRef.current,
          combo: speedSnapshotRef.current.effectiveCombo,
          idle: speedSnapshotRef.current.idle,
          errorPenalty: speedSnapshotRef.current.errorPenalty,
          aiCurrentPerformanceRate: aiStateRef.current.currentPerformanceRate,
          aiTargetPerformanceRate: aiStateRef.current.targetPerformanceRate,
          aiActualSpeed: aiStateRef.current.currentSpeed,
        })
        lastHudTimestamp = timestampMilliseconds
      }
      animationFrame = window.requestAnimationFrame(renderFrame)
    }

    animationFrame = window.requestAnimationFrame(renderFrame)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [])

  const handleCompositionEnd = (text: string) => {
    const result = reduceImeInput(imeStateRef.current, { type: 'compositionend', text })
    imeStateRef.current = result.state
    const fallbackVersion = result.fallbackVersion
    if (fallbackVersion === undefined) return
    queueMicrotask(() => {
      const fallback = consumeImeFallback(imeStateRef.current, fallbackVersion)
      consumeImeResult(fallback, simulationTimestampRef.current)
      if (fallback.committedText !== undefined && inputRef.current !== null) inputRef.current.value = ''
      if (fallback.committedText !== undefined) {
        window.setTimeout(() => {
          imeStateRef.current = clearImeSuppression(imeStateRef.current)
        }, 0)
      }
    })
  }

  const completed = typingView.targetGraphemes.slice(0, typingView.correctIndex).join('')
  const current = typingView.targetGraphemes[typingView.correctIndex] ?? ''
  const remaining = typingView.targetGraphemes.slice(typingView.correctIndex + 1).join('')

  return (
    <section className="debug-preview" aria-labelledby="debug-preview-title">
      <div className="debug-preview__heading">
        <div>
          <p className="debug-preview__eyebrow">开发预览</p>
          <h2 id="debug-preview-title">输入与动态速度调试</h2>
        </div>
        <p>第一次正确输入后开始追逐；玩家和 AI 使用等价的表现率速度映射。</p>
      </div>

      <div className="game-debug-controls" aria-label="本局调试配置">
        <div className="debug-choice" aria-label="玩家身份">
          <strong>玩家身份</strong>
          <button
            type="button"
            aria-pressed={playerRole === PLAYER_THIEF}
            onClick={() => resetRound({ playerRole: PLAYER_THIEF })}
          >小偷</button>
          <button
            type="button"
            aria-pressed={playerRole === PLAYER_POLICE}
            onClick={() => resetRound({ playerRole: PLAYER_POLICE })}
          >警察</button>
        </div>
        <div className="debug-choice" aria-label="AI 难度">
          <strong>AI 难度</strong>
          {(Object.keys(DIFFICULTY_LABELS) as AiDifficulty[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={difficulty === option}
              onClick={() => resetRound({ difficulty: option })}
            >{DIFFICULTY_LABELS[option]}</button>
          ))}
        </div>
      </div>

      <div className="typing-debug" aria-label="打字速度调试区">
        <div className="typing-language" aria-label="调试语言">
          <button type="button" aria-pressed={language === 'english'} onClick={() => selectLanguage('english')}>English</button>
          <button type="button" aria-pressed={language === 'chinese'} onClick={() => selectLanguage('chinese')}>中文</button>
          <span>{phaseLabel(gameSessionView.phase)}</span>
        </div>
        <p className="typing-article" aria-label="调试文章">
          <span className="typing-article__done">{completed}</span>
          <span className="typing-article__current">{current}</span>
          <span>{remaining}</span>
        </p>
        <textarea
          ref={inputRef}
          className="typing-input"
          aria-label="打字输入入口"
          autoFocus
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={gameSessionView.phase === 'won' || gameSessionView.phase === 'lost'}
          onPaste={(event) => event.preventDefault()}
          onDrop={(event) => event.preventDefault()}
          onBeforeInput={(event) => {
            const inputType = (event.nativeEvent as InputEvent).inputType
            if (shouldBlockBrowserInputType(inputType)) event.preventDefault()
          }}
          onCompositionStart={() => {
            imeStateRef.current = reduceImeInput(imeStateRef.current, { type: 'compositionstart' }).state
          }}
          onCompositionUpdate={(event) => {
            imeStateRef.current = reduceImeInput(imeStateRef.current, {
              type: 'compositionupdate', text: event.data,
            }).state
          }}
          onCompositionEnd={(event) => handleCompositionEnd(event.data)}
          onInput={(event) => {
            const nativeEvent = event.nativeEvent as InputEvent
            const result = reduceImeInput(imeStateRef.current, {
              type: 'input',
              text: event.currentTarget.value,
              isComposing: nativeEvent.isComposing,
            })
            consumeImeResult(result, simulationTimestampRef.current)
            if (result.committedText !== undefined) event.currentTarget.value = ''
          }}
        />
        <small>拼音候选组合期间不会计入正确或错误。</small>
      </div>

      <div className="game-result-debug" role="status">
        <span>本局状态：{phaseLabel(gameSessionView.phase)}</span>
        <button type="button" onClick={() => resetRound()}>重新开始</button>
      </div>

      <div className="debug-view-controls" aria-label="摄像机视图">
        <button type="button" aria-pressed={mode === 'followThief'} onClick={() => selectMode('followThief')}>跟随小偷</button>
        <button type="button" aria-pressed={mode === 'followPolice'} onClick={() => selectMode('followPolice')}>跟随警察</button>
        <button type="button" aria-pressed={mode === 'overview'} onClick={() => selectMode('overview')}>全图 Debug</button>
        <span>当前视图：{mode === 'followThief' ? '跟随小偷' : mode === 'followPolice' ? '跟随警察' : '全图 Debug'}</span>
      </div>

      <canvas ref={canvasRef} className="debug-preview__canvas" width="960" height="600" aria-label="地图与车辆自动追逐画面">
        当前浏览器不支持 Canvas 调试画面。
      </canvas>

      <dl className="debug-hud" aria-label="追逐与输入调试数据">
        <div><dt>游戏阶段</dt><dd>{phaseLabel(gameSessionView.phase)}</dd></div>
        <div><dt>玩家身份</dt><dd>{playerRole === PLAYER_THIEF ? '小偷' : '警察'}</dd></div>
        <div><dt>AI 难度</dt><dd>{DIFFICULTY_LABELS[difficulty]}</dd></div>
        <div><dt>Recent performance</dt><dd>{typingHud.performanceRate.toFixed(1)} {language === 'english' ? 'WPM' : '字/分钟'}</dd></div>
        <div><dt>Target speed</dt><dd>{typingHud.targetSpeed.toFixed(1)}</dd></div>
        <div><dt>Actual speed</dt><dd>{typingHud.actualSpeed.toFixed(1)}</dd></div>
        <div><dt>Combo</dt><dd>{typingHud.combo}</dd></div>
        <div><dt>Idle state</dt><dd>{typingHud.idle ? '空闲' : '输入中'}</dd></div>
        <div><dt>Error penalty</dt><dd>{typingHud.errorPenalty.toFixed(2)}×</dd></div>
        <div><dt>输入错误</dt><dd>{typingView.errorCount}</dd></div>
        <div><dt>AI current performance</dt><dd>{typingHud.aiCurrentPerformanceRate.toFixed(1)}</dd></div>
        <div><dt>AI target performance</dt><dd>{typingHud.aiTargetPerformanceRate.toFixed(1)}</dd></div>
        <div><dt>AI actual speed</dt><dd>{typingHud.aiActualSpeed.toFixed(1)}</dd></div>
        <div><dt>当前方向</dt><dd>{hud.direction}</dd></div>
        <div><dt>有向领先距离</dt><dd>{hud.lead}</dd></div>
        <div><dt>同步掉头次数</dt><dd>{hud.reverseCount}</dd></div>
        <div><dt>追逐状态</dt><dd>{hud.captured}</dd></div>
      </dl>
    </section>
  )
}

export default DebugChasePreview
