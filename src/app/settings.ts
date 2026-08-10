import { filterArticles, type Article } from '../articles'
import type { AiDifficulty } from '../game/ai'
import { PLAYER_POLICE, PLAYER_THIEF, type PlayerRole } from '../game/gameSession'
import type { ArticleLanguage, ArticleLength } from '../articles'
import type { ArticleSelectionMode, GameSettings } from './types'

export const SETTINGS_STORAGE_KEY = 'typing-gaming.settings.v1'

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  playerRole: PLAYER_THIEF,
  language: 'english',
  difficulty: 'normal',
  articleLength: 'short',
  articleMode: 'choose',
  selectedArticleId: 'en-short-morning-current',
  keySoundEnabled: true,
  errorSoundEnabled: true,
}

const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === 'string' && values.includes(value as T)

export function normalizeSettings(candidate: unknown, articles: readonly Article[]): GameSettings {
  const value = candidate !== null && typeof candidate === 'object'
    ? candidate as Partial<Record<keyof GameSettings, unknown>>
    : {}
  const playerRole: PlayerRole = isOneOf(value.playerRole, [PLAYER_POLICE, PLAYER_THIEF])
    ? value.playerRole
    : DEFAULT_GAME_SETTINGS.playerRole
  const language: ArticleLanguage = isOneOf(value.language, ['english', 'chinese'])
    ? value.language
    : DEFAULT_GAME_SETTINGS.language
  const difficulty: AiDifficulty = isOneOf(value.difficulty, ['easy', 'normal', 'hard', 'shadow'])
    ? value.difficulty
    : DEFAULT_GAME_SETTINGS.difficulty
  const articleLength: ArticleLength = isOneOf(value.articleLength, ['short', 'medium', 'long'])
    ? value.articleLength
    : DEFAULT_GAME_SETTINGS.articleLength
  const articleMode: ArticleSelectionMode = isOneOf(value.articleMode, ['choose', 'random'])
    ? value.articleMode
    : DEFAULT_GAME_SETTINGS.articleMode
  const pool = filterArticles(articles, language, articleLength)
  const selectedArticleId = typeof value.selectedArticleId === 'string'
    && pool.some((article) => article.id === value.selectedArticleId)
    ? value.selectedArticleId
    : (pool[0]?.id ?? '')

  return {
    playerRole,
    language,
    difficulty,
    articleLength,
    articleMode,
    selectedArticleId,
    keySoundEnabled: typeof value.keySoundEnabled === 'boolean'
      ? value.keySoundEnabled
      : DEFAULT_GAME_SETTINGS.keySoundEnabled,
    errorSoundEnabled: typeof value.errorSoundEnabled === 'boolean'
      ? value.errorSoundEnabled
      : DEFAULT_GAME_SETTINGS.errorSoundEnabled,
  }
}

export function loadSettings(storage: StorageAdapter | undefined, articles: readonly Article[]): GameSettings {
  if (storage === undefined) return normalizeSettings(DEFAULT_GAME_SETTINGS, articles)
  try {
    const serialized = storage.getItem(SETTINGS_STORAGE_KEY)
    return normalizeSettings(serialized === null ? DEFAULT_GAME_SETTINGS : JSON.parse(serialized), articles)
  } catch {
    return normalizeSettings(DEFAULT_GAME_SETTINGS, articles)
  }
}

export function saveSettings(storage: StorageAdapter | undefined, settings: GameSettings): boolean {
  if (storage === undefined) return false
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}
