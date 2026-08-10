import {
  filterArticles,
  findArticleById,
  selectRandomArticle,
  type Article,
} from '../articles'
import type { GameSettings } from './types'

export function resolveRoundArticle(
  settings: GameSettings,
  articles: readonly Article[],
  random: () => number = Math.random,
): Article | undefined {
  if (settings.articleMode === 'random') {
    return selectRandomArticle(articles, settings.language, settings.articleLength, random)
  }
  const selected = findArticleById(articles, settings.selectedArticleId)
  if (selected?.language === settings.language && selected.length === settings.articleLength) return selected
  return filterArticles(articles, settings.language, settings.articleLength)[0]
}
