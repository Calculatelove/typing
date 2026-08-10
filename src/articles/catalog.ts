import type { Article, ArticleLanguage, ArticleLength } from './types'

export function filterArticles(
  articles: readonly Article[],
  language: ArticleLanguage,
  length: ArticleLength,
): readonly Article[] {
  return articles.filter(
    (article) => article.language === language && article.length === length,
  )
}

export function findArticleById(
  articles: readonly Article[],
  id: string,
): Article | undefined {
  return articles.find((article) => article.id === id)
}

export function selectRandomArticle(
  articles: readonly Article[],
  language: ArticleLanguage,
  length: ArticleLength,
  random: () => number = Math.random,
): Article | undefined {
  const pool = filterArticles(articles, language, length)
  if (pool.length === 0) return undefined
  const randomValue = random()
  const safeValue = Number.isFinite(randomValue)
    ? Math.max(0, Math.min(0.999999999999, randomValue))
    : 0
  return pool[Math.floor(safeValue * pool.length)]
}
