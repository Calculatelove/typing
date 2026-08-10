import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FIXTURE_ARTICLES } from '../articles'
import { PLAYER_POLICE, PLAYER_THIEF } from '../game/gameSession'
import type { PlayerRole } from '../game/gameSession'
import App from './App'
import { resolveRoundArticle } from './roundSelection'
import { DEFAULT_GAME_SETTINGS } from './settings'

describe('正式 App 页面流', () => {
  it('默认呈现完整 Setup 而不是开发预览', () => {
    const markup = renderToStaticMarkup(<App />)
    expect(markup).toContain('<h1>Typing Gaming</h1>')
    expect(markup).toContain('Start Chase')
    expect(markup).not.toContain('开发预览')
    expect(markup).not.toContain('<canvas')
  })

  it('两种身份与四档难度都能解析合法文章并开始', () => {
    for (const playerRole of [PLAYER_POLICE, PLAYER_THIEF] as readonly PlayerRole[]) {
      for (const difficulty of ['easy', 'normal', 'hard', 'shadow'] as const) {
        const article = resolveRoundArticle(
          { ...DEFAULT_GAME_SETTINGS, playerRole, difficulty },
          FIXTURE_ARTICLES,
          () => 0.5,
        )
        expect(article?.language).toBe('english')
        expect(article?.length).toBe('short')
      }
    }
  })

  it('Random Article 只从当前语言和长度池选择', () => {
    const article = resolveRoundArticle({
      ...DEFAULT_GAME_SETTINGS,
      language: 'chinese',
      articleLength: 'long',
      articleMode: 'random',
    }, FIXTURE_ARTICLES, () => 0.999)
    expect(article?.id).toBe('zh-long-night-care')
  })
})
