export type ArticleLanguage = 'english' | 'chinese'
export type ArticleLength = 'short' | 'medium' | 'long'

export interface Article {
  readonly id: string
  readonly title: string
  readonly language: ArticleLanguage
  readonly length: ArticleLength
  readonly text: string
  readonly scoredGraphemeCount: number
  readonly wordCount: number
  readonly estimatedSecondsAt50: number
  readonly sourceType: 'original-fixture'
  readonly sourceLabel: string
  readonly sourceUrl: string | null
  readonly license: '项目原创'
  readonly tags: readonly string[]
}
