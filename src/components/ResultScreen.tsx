import type { GameResult } from '../app/types'

interface ResultScreenProps {
  readonly result: GameResult
  readonly onRetry: () => void
  readonly onBack: () => void
}

export function ResultScreen({ result, onRetry, onBack }: ResultScreenProps) {
  return (
    <main className={`result-screen result-screen--${result.outcome}`}>
      <section className="result-card">
        <p className="eyebrow">Chase complete</p>
        <h1>{result.outcome === 'won' ? 'Victory' : 'Defeat'}</h1>
        <p className="result-article">{result.article.title} · {result.article.sourceLabel}</p>
        <dl className="result-stats">
          <div><dt>最终平均速度</dt><dd>{result.averageSpeed.toFixed(1)}</dd></div>
          <div><dt>Accuracy</dt><dd>{(result.accuracy * 100).toFixed(1)}%</dd></div>
          <div><dt>Errors</dt><dd>{result.errors}</dd></div>
          <div><dt>完成时间</dt><dd>{result.completionSeconds.toFixed(1)} s</dd></div>
        </dl>
        <div className="result-actions">
          <button className="primary-action" type="button" onClick={onRetry}>再来一次</button>
          <button className="secondary-action" type="button" onClick={onBack}>返回设置</button>
        </div>
      </section>
    </main>
  )
}
