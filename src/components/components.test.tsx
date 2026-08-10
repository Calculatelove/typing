import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { FIXTURE_ARTICLES } from '../articles'
import { DEFAULT_GAME_SETTINGS } from '../app/settings'
import type { GameResult } from '../app/types'
import { createTypingSession } from '../input'
import { ArticleDisplay } from './ArticleDisplay'
import { GameHud } from './GameHud'
import { GameScreen } from './GameScreen'
import { ResultScreen } from './ResultScreen'
import { SetupScreen } from './SetupScreen'

describe('正式页面展示组件', () => {
  it('Setup 提供完整选择与音效开关', () => {
    const markup = renderToStaticMarkup(
      <SetupScreen
        settings={DEFAULT_GAME_SETTINGS}
        articles={FIXTURE_ARTICLES}
        onChange={vi.fn()}
        onStart={vi.fn()}
      />,
    )
    expect(markup).toContain('Typing Gaming')
    expect(markup).toContain('Player Role')
    expect(markup).toContain('Police')
    expect(markup).toContain('Choose Article')
    expect(markup).toContain('Key Sound')
    expect(markup).toContain('Start Chase')
  })

  it('文章将已完成、当前字符和剩余部分独立渲染', () => {
    const state = { ...createTypingSession('road'), correctIndex: 1, correctCount: 1 }
    const markup = renderToStaticMarkup(<ArticleDisplay typing={state} errorPulse={false} />)
    expect(markup).toContain('article-display__done')
    expect(markup).toContain('article-display__current')
    expect(markup).toContain('article-display__remaining')
    expect(markup).toContain('>o<')
    expect(markup).toContain('<mark class="article-display__current" aria-live="polite" aria-atomic="true">')
    expect(markup).not.toContain('class="article-display" aria-live')
  })

  it('文章池为空时禁止开始并给出稳定提示', () => {
    const markup = renderToStaticMarkup(
      <SetupScreen settings={DEFAULT_GAME_SETTINGS} articles={[]} onChange={vi.fn()} onStart={vi.fn()} />,
    )
    expect(markup).toContain('当前筛选条件下没有可用文章')
    expect(markup).toContain('disabled=""')
  })

  it('HUD 显示要求的实时信息', () => {
    const markup = renderToStaticMarkup(<GameHud
      roleLabel="Thief"
      difficultyLabel="Normal"
      performanceRate={50}
      performanceUnit="WPM"
      actualSpeed={120}
      targetSpeed={130}
      accuracy={0.98}
      combo={12}
      errors={1}
      progress={0.3}
      phaseLabel="Running"
      pursuitDistance={420}
    />)
    for (const label of ['Thief', 'Normal', 'WPM', 'Vehicle', 'Accuracy', 'Combo', 'Errors', 'Progress', 'Running']) {
      expect(markup).toContain(label)
    }
  })

  it('Result 显示胜负、统计与两种后续操作', () => {
    const article = FIXTURE_ARTICLES[0]!
    const result: GameResult = {
      outcome: 'won', averageSpeed: 123, accuracy: 0.95, errors: 2, correct: 38,
      completionSeconds: 42.3, article, settings: DEFAULT_GAME_SETTINGS,
    }
    const markup = renderToStaticMarkup(
      <ResultScreen result={result} onRetry={vi.fn()} onBack={vi.fn()} />,
    )
    expect(markup).toContain('Victory')
    expect(markup).toContain('再来一次')
    expect(markup).toContain('返回设置')
    expect(markup).toContain(article.title)
  })

  it('正式 Game 只有跟随玩家的 Canvas、文章输入和 HUD', () => {
    const markup = renderToStaticMarkup(<GameScreen
      round={{ id: 1, settings: DEFAULT_GAME_SETTINGS, article: FIXTURE_ARTICLES[0]! }}
      onComplete={vi.fn()}
    />)
    expect(markup).toContain('aria-label="Typing Gaming game world"')
    expect(markup).toContain('aria-label="文章输入"')
    expect(markup).toContain('Game HUD')
    expect(markup).not.toContain('全图 Debug')
  })
})
