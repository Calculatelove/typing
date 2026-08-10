import type { TypingSessionState } from '../input'

interface ArticleDisplayProps {
  readonly typing: TypingSessionState
  readonly errorPulse: boolean
}

export function ArticleDisplay({ typing, errorPulse }: ArticleDisplayProps) {
  const done = typing.targetGraphemes.slice(0, typing.correctIndex).join('')
  const current = typing.targetGraphemes[typing.correctIndex] ?? ''
  const remaining = typing.targetGraphemes.slice(typing.correctIndex + 1).join('')
  return (
    <div className={`article-display${errorPulse ? ' article-display--error' : ''}`}>
      <span className="article-display__done">{done}</span>
      <mark className="article-display__current" aria-live="polite" aria-atomic="true">{current || '✓'}</mark>
      <span className="article-display__remaining">{remaining}</span>
    </div>
  )
}
