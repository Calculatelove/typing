import { useEffect, useRef, useState } from 'react'

import {
  advancePursuitFrame,
  createDebugPursuit,
  type PursuitFrameState,
} from '../game/engine'
import { getThiefLead } from '../game/pursuit'
import { renderDebugScene } from '../game/renderDebugScene'
import { createDefaultTrack } from '../game/track'
import type { PursuitState, Track } from '../game/types'

const DEBUG_TRACK = createDefaultTrack()
const DEBUG_PURSUIT = createDebugPursuit(DEBUG_TRACK)

interface DebugHud {
  readonly direction: string
  readonly lead: string
  readonly reverseCount: number
  readonly captured: string
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
  const [hud, setHud] = useState(() => toHud(DEBUG_TRACK, DEBUG_PURSUIT.state))

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (canvas === null || canvas === undefined || context === null || context === undefined) {
      return undefined
    }

    let frame: PursuitFrameState = {
      state: DEBUG_PURSUIT.state,
      accumulatorSeconds: 0,
    }
    let animationFrame = 0
    let previousTimestamp: number | undefined
    let lastHudTimestamp = 0

    const renderFrame = (timestamp: number) => {
      const rectangle = canvas.getBoundingClientRect()
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      const displayWidth = Math.max(1, rectangle.width || 960)
      const displayHeight = Math.max(1, rectangle.height || 600)
      const pixelWidth = Math.round(displayWidth * pixelRatio)
      const pixelHeight = Math.round(displayHeight * pixelRatio)
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }

      if (previousTimestamp !== undefined) {
        frame = advancePursuitFrame(
          DEBUG_TRACK,
          frame,
          (timestamp - previousTimestamp) / 1000,
          DEBUG_PURSUIT.config,
        )
      }
      previousTimestamp = timestamp

      renderDebugScene(context, DEBUG_TRACK, frame.state, {
        width: pixelWidth,
        height: pixelHeight,
      })
      if (timestamp - lastHudTimestamp >= 100) {
        setHud(toHud(DEBUG_TRACK, frame.state))
        lastHudTimestamp = timestamp
      }
      animationFrame = window.requestAnimationFrame(renderFrame)
    }

    animationFrame = window.requestAnimationFrame(renderFrame)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [])

  return (
    <section className="debug-preview" aria-labelledby="debug-preview-title">
      <div className="debug-preview__heading">
        <div>
          <p className="debug-preview__eyebrow">开发预览</p>
          <h2 id="debug-preview-title">闭环追逐调试预览</h2>
        </div>
        <p>两辆车使用固定测试速度自动运行，用于观察套圈、掉头和道路投影。</p>
      </div>

      <canvas
        ref={canvasRef}
        className="debug-preview__canvas"
        width="960"
        height="600"
        aria-label="地图与车辆自动追逐画面"
      >
        当前浏览器不支持 Canvas 调试画面。
      </canvas>

      <dl className="debug-hud" aria-label="追逐调试数据">
        <div>
          <dt>当前方向</dt>
          <dd>{hud.direction}</dd>
        </div>
        <div>
          <dt>有向领先距离</dt>
          <dd>{hud.lead}</dd>
        </div>
        <div>
          <dt>警察固定速度</dt>
          <dd>{(DEBUG_PURSUIT.state.police.speed).toFixed(0)}</dd>
        </div>
        <div>
          <dt>小偷固定速度</dt>
          <dd>{(DEBUG_PURSUIT.state.thief.speed).toFixed(0)}</dd>
        </div>
        <div>
          <dt>同步掉头次数</dt>
          <dd>{hud.reverseCount}</dd>
        </div>
        <div>
          <dt>追逐状态</dt>
          <dd>{hud.captured}</dd>
        </div>
      </dl>
    </section>
  )
}

export default DebugChasePreview
