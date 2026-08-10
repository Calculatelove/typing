// @vitest-environment jsdom

import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FIXTURE_ARTICLES } from '../articles'
import { GameScreen } from '../components'
import App from './App'
import { DEFAULT_GAME_SETTINGS } from './settings'
import type { GameResult, ResolvedRound } from './types'

interface FrameController {
  readonly cancel: ReturnType<typeof vi.fn>
  runNext(timestamp: number): void
  pending(): number
}

function installAnimationFrames(): FrameController {
  let nextId = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++nextId
    callbacks.set(id, callback)
    return id
  })
  const cancel = vi.fn((id: number) => { callbacks.delete(id) })
  vi.stubGlobal('cancelAnimationFrame', cancel)
  return {
    cancel,
    runNext(timestamp) {
      const entry = callbacks.entries().next().value as [number, FrameRequestCallback] | undefined
      if (entry === undefined) throw new Error('没有待执行的 animation frame。')
      callbacks.delete(entry[0])
      entry[1](timestamp)
    },
    pending: () => callbacks.size,
  }
}

function createCanvasContext(): CanvasRenderingContext2D {
  const noop = () => undefined
  const gradient = { addColorStop: noop }
  return new Proxy({
    createLinearGradient: () => gradient,
  } as unknown as CanvasRenderingContext2D, {
    get(target, property) {
      const value = Reflect.get(target, property)
      return value === undefined ? noop : value
    },
    set(target, property, value) {
      Reflect.set(target, property, value)
      return true
    },
  })
}

function finishCurrentArticle(frames: FrameController, firstTimestamp = 0): void {
  const input = screen.getByRole('textbox', { name: '文章输入' })
  const articleText = document.querySelector('.article-display')?.textContent
  if (articleText === undefined) throw new Error('找不到当前文章。')
  fireEvent.input(input, { target: { value: articleText } })
  act(() => frames.runNext(firstTimestamp))
  act(() => frames.runNext(firstTimestamp + 100))
}

describe('正式 React 游戏流程', () => {
  let getContext: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => createCanvasContext())
  })

  afterEach(() => {
    cleanup()
    getContext?.mockRestore()
    vi.unstubAllGlobals()
  })

  it('真实 Hook 从首次正确输入运行到终局，结果只交付一次且卸载取消 rAF', () => {
    const frames = installAnimationFrames()
    const onComplete = vi.fn<(result: GameResult) => void>()
    const round: ResolvedRound = {
      id: 1,
      settings: DEFAULT_GAME_SETTINGS,
      article: FIXTURE_ARTICLES[0]!,
    }
    const view = render(<GameScreen round={round} onComplete={onComplete} />)
    expect(screen.getAllByText('Ready — start typing')).toHaveLength(2)
    act(() => frames.runNext(0))
    act(() => frames.runNext(5_000))
    expect(onComplete).not.toHaveBeenCalled()

    finishCurrentArticle(frames, 6_000)
    expect(onComplete).toHaveBeenCalledOnce()
    expect(onComplete.mock.calls[0]?.[0].outcome).toBe('won')
    expect(onComplete.mock.calls[0]?.[0].completionSeconds).toBeGreaterThan(0)
    expect(onComplete.mock.calls[0]?.[0].completionSeconds).toBeLessThan(0.2)

    act(() => frames.runNext(6_200))
    expect(onComplete).toHaveBeenCalledOnce()
    view.unmount()
    expect(frames.cancel).toHaveBeenCalled()
    expect(frames.pending()).toBe(0)
  })

  it('App 完成后进入 Result，Retry 创建重置后的新本局', () => {
    const frames = installAnimationFrames()
    render(<StrictMode><App /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Start Chase' }))
    expect(screen.getByRole('textbox', { name: '文章输入' })).toBeTruthy()

    finishCurrentArticle(frames)
    expect(screen.getByRole('heading', { name: 'Victory' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '再来一次' }))

    expect(screen.getByRole('textbox', { name: '文章输入' })).toBeTruthy()
    expect(screen.getAllByText('Ready — start typing')).toHaveLength(2)
    expect(document.querySelector('.article-display__done')?.textContent).toBe('')
    expect(document.querySelector('.article-display__current')?.textContent).toBe('M')
  })
})
