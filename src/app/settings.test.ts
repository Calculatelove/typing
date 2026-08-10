import { describe, expect, it } from 'vitest'

import { FIXTURE_ARTICLES, filterArticles } from '../articles'
import { PLAYER_POLICE } from '../game/gameSession'
import type { GameSettings } from './types'
import {
  DEFAULT_GAME_SETTINGS,
  SETTINGS_STORAGE_KEY,
  loadSettings,
  normalizeSettings,
  saveSettings,
  type StorageAdapter,
} from './settings'

function createMemoryStorage(): StorageAdapter & { readonly data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
  }
}

describe('游戏设置', () => {
  it('空存储使用完整默认值', () => {
    expect(loadSettings(createMemoryStorage(), FIXTURE_ARTICLES)).toEqual(DEFAULT_GAME_SETTINGS)
  })

  it('可以完整保存并恢复合法设置', () => {
    const storage = createMemoryStorage()
    const settings: GameSettings = {
      ...DEFAULT_GAME_SETTINGS,
      playerRole: PLAYER_POLICE,
      language: 'chinese' as const,
      difficulty: 'hard' as const,
      articleLength: 'long' as const,
      articleMode: 'random' as const,
      selectedArticleId: 'zh-long-night-care',
      keySoundEnabled: false,
    }
    expect(saveSettings(storage, settings)).toBe(true)
    expect(loadSettings(storage, FIXTURE_ARTICLES)).toEqual(settings)
  })

  it('损坏 JSON 和存储异常均安全回退', () => {
    const storage = createMemoryStorage()
    storage.data.set(SETTINGS_STORAGE_KEY, '{broken')
    expect(loadSettings(storage, FIXTURE_ARTICLES)).toEqual(DEFAULT_GAME_SETTINGS)
    expect(loadSettings({ getItem: () => { throw new Error('blocked') }, setItem: () => {} }, FIXTURE_ARTICLES))
      .toEqual(DEFAULT_GAME_SETTINGS)
    expect(saveSettings({ getItem: () => null, setItem: () => { throw new Error('full') } }, DEFAULT_GAME_SETTINGS))
      .toBe(false)
  })

  it('逐字段拒绝未知值且保留合法字段', () => {
    const normalized = normalizeSettings({
      ...DEFAULT_GAME_SETTINGS,
      playerRole: 'unknown',
      difficulty: 'hard',
      keySoundEnabled: false,
    }, FIXTURE_ARTICLES)
    expect(normalized.playerRole).toBe(DEFAULT_GAME_SETTINGS.playerRole)
    expect(normalized.difficulty).toBe('hard')
    expect(normalized.keySoundEnabled).toBe(false)
  })

  it('语言或长度改变后修复不在当前池内的文章 ID', () => {
    const normalized = normalizeSettings({
      ...DEFAULT_GAME_SETTINGS,
      language: 'chinese',
      selectedArticleId: DEFAULT_GAME_SETTINGS.selectedArticleId,
    }, FIXTURE_ARTICLES)
    expect(normalized.selectedArticleId).toBe(
      filterArticles(FIXTURE_ARTICLES, 'chinese', 'short')[0]?.id,
    )
  })
})
