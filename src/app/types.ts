import type { Article } from '../articles'
import type { AiDifficulty } from '../game/ai'
import type { GamePhase, PlayerRole } from '../game/gameSession'
import type { ArticleLanguage, ArticleLength } from '../articles'

export type ArticleSelectionMode = 'choose' | 'random'

export interface GameSettings {
  readonly playerRole: PlayerRole
  readonly language: ArticleLanguage
  readonly difficulty: AiDifficulty
  readonly articleLength: ArticleLength
  readonly articleMode: ArticleSelectionMode
  readonly selectedArticleId: string
  readonly keySoundEnabled: boolean
  readonly errorSoundEnabled: boolean
}

export interface ResolvedRound {
  readonly id: number
  readonly settings: GameSettings
  readonly article: Article
}

export interface GameResult {
  readonly outcome: Extract<GamePhase, 'won' | 'lost'>
  readonly averageSpeed: number
  readonly accuracy: number
  readonly errors: number
  readonly correct: number
  readonly completionSeconds: number
  readonly article: Article
  readonly settings: GameSettings
}
