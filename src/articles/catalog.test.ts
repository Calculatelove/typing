import { describe, expect, it } from 'vitest'

import { segmentGraphemes } from '../input'
import {
  FIXTURE_ARTICLES,
  filterArticles,
  findArticleById,
  selectRandomArticle,
  type ArticleLanguage,
  type ArticleLength,
} from './index'

const languages: readonly ArticleLanguage[] = ['english', 'chinese']
const lengths: readonly ArticleLength[] = ['short', 'medium', 'long']

describe('原创 fixture 文章目录', () => {
  it('包含语言和长度每组两篇，共十二篇且 ID 唯一', () => {
    expect(FIXTURE_ARTICLES).toHaveLength(12)
    expect(new Set(FIXTURE_ARTICLES.map((article) => article.id)).size).toBe(12)
    for (const language of languages) {
      for (const length of lengths) {
        expect(filterArticles(FIXTURE_ARTICLES, language, length)).toHaveLength(2)
      }
    }
  })

  it('所有文章都明确标记为项目原创 fixture 并具有完整计分元数据', () => {
    for (const article of FIXTURE_ARTICLES) {
      expect(article.sourceType).toBe('original-fixture')
      expect(article.sourceLabel).toBe('Typing Gaming 原创 fixture')
      expect(article.sourceUrl).toBeNull()
      expect(article.license).toBe('项目原创')
      expect(article.scoredGraphemeCount).toBe(segmentGraphemes(article.text).length)
      expect(article.estimatedSecondsAt50).toBeGreaterThan(0)
    }
  })

  it('英文按词数、中文按计分 grapheme 落入对应正式长度范围', () => {
    const ranges: Readonly<Record<ArticleLength, readonly [number, number]>> = {
      short: [90, 110],
      medium: [190, 210],
      long: [290, 310],
    }
    for (const article of FIXTURE_ARTICLES) {
      const measure = article.language === 'english'
        ? article.wordCount
        : article.scoredGraphemeCount
      expect(measure).toBeGreaterThanOrEqual(ranges[article.length][0])
      expect(measure).toBeLessThanOrEqual(ranges[article.length][1])
    }
  })

  it('按 ID 查找并在缺失时返回 undefined', () => {
    const first = FIXTURE_ARTICLES[0]
    expect(findArticleById(FIXTURE_ARTICLES, first.id)).toBe(first)
    expect(findArticleById(FIXTURE_ARTICLES, 'missing')).toBeUndefined()
  })

  it('随机选择严格限制在当前语言和长度池并 clamp 随机边界', () => {
    const pool = filterArticles(FIXTURE_ARTICLES, 'english', 'short')
    expect(selectRandomArticle(FIXTURE_ARTICLES, 'english', 'short', () => -1)).toBe(pool[0])
    expect(selectRandomArticle(FIXTURE_ARTICLES, 'english', 'short', () => 0.999)).toBe(pool[1])
    expect(selectRandomArticle(FIXTURE_ARTICLES, 'english', 'short', () => 2)).toBe(pool[1])
  })
})
