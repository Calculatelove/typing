import { filterArticles, type Article } from '../articles'
import type { GameSettings } from '../app/types'
import { PLAYER_POLICE, PLAYER_THIEF } from '../game/gameSession'

interface SetupScreenProps {
  readonly settings: GameSettings
  readonly articles: readonly Article[]
  readonly onChange: (settings: GameSettings) => void
  readonly onStart: () => void
}

const groupOptions = <T extends string>(
  values: readonly { readonly value: T; readonly label: string }[],
  selected: T,
  onSelect: (value: T) => void,
) => values.map(({ value, label }) => (
  <button
    key={value}
    className="choice-button"
    type="button"
    aria-pressed={selected === value}
    onClick={() => onSelect(value)}
  >{label}</button>
))

function articleLengthLabel(article: Article): string {
  return article.language === 'english'
    ? `${article.wordCount} words`
    : `${article.scoredGraphemeCount} 字符`
}

export function SetupScreen({ settings, articles, onChange, onStart }: SetupScreenProps) {
  const pool = filterArticles(articles, settings.language, settings.articleLength)
  const canStart = pool.length > 0
  const update = (patch: Partial<GameSettings>) => onChange({ ...settings, ...patch })
  const updatePool = (patch: Pick<GameSettings, 'language'> | Pick<GameSettings, 'articleLength'>) => {
    const next = { ...settings, ...patch }
    const nextPool = filterArticles(articles, next.language, next.articleLength)
    onChange({ ...next, selectedArticleId: nextPool[0]?.id ?? '' })
  }

  return (
    <main className="setup-screen">
      <section className="setup-hero">
        <p className="eyebrow">Type. Accelerate. Chase.</p>
        <h1>Typing Gaming</h1>
        <p>让最近三秒的打字节奏驱动电动车，在城市环道上完成一场单人追逐。</p>
      </section>

      <section className="setup-panel" aria-label="Game settings">
        <fieldset><legend>Player Role</legend><div className="choice-row">
          {groupOptions([
            { value: PLAYER_POLICE, label: 'Police' },
            { value: PLAYER_THIEF, label: 'Thief' },
          ], settings.playerRole, (playerRole) => update({ playerRole }))}
        </div></fieldset>

        <fieldset><legend>Language</legend><div className="choice-row">
          {groupOptions([
            { value: 'chinese' as const, label: '中文' },
            { value: 'english' as const, label: 'English' },
          ], settings.language, (language) => updatePool({ language }))}
        </div></fieldset>

        <fieldset><legend>Difficulty</legend><div className="choice-row choice-row--four">
          {groupOptions([
            { value: 'easy' as const, label: 'Easy' },
            { value: 'normal' as const, label: 'Normal' },
            { value: 'hard' as const, label: 'Hard' },
            { value: 'shadow' as const, label: 'Shadow' },
          ], settings.difficulty, (difficulty) => update({ difficulty }))}
        </div></fieldset>

        <fieldset><legend>Article Length</legend><div className="choice-row">
          {groupOptions([
            { value: 'short' as const, label: 'Short' },
            { value: 'medium' as const, label: 'Medium' },
            { value: 'long' as const, label: 'Long' },
          ], settings.articleLength, (articleLength) => updatePool({ articleLength }))}
        </div></fieldset>

        <fieldset><legend>Article</legend><div className="choice-row">
          {groupOptions([
            { value: 'choose' as const, label: 'Choose Article' },
            { value: 'random' as const, label: 'Random Article' },
          ], settings.articleMode, (articleMode) => update({ articleMode }))}
        </div>
          {!canStart ? <p className="setup-error" role="alert">当前筛选条件下没有可用文章。</p> : settings.articleMode === 'choose' ? (
            <div className="article-picker">
              {pool.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  className="article-card"
                  aria-pressed={article.id === settings.selectedArticleId}
                  onClick={() => update({ selectedArticleId: article.id })}
                >
                  <strong>{article.title}</strong>
                  <span>{articleLengthLabel(article)} · {article.sourceLabel}</span>
                </button>
              ))}
            </div>
          ) : <p className="setup-hint">将从当前语言和长度分类中随机选择一篇。</p>}
        </fieldset>

        <fieldset><legend>Audio</legend><div className="toggle-row">
          <label><input type="checkbox" checked={settings.keySoundEnabled} onChange={(event) => update({ keySoundEnabled: event.currentTarget.checked })} />Key Sound</label>
          <label><input type="checkbox" checked={settings.errorSoundEnabled} onChange={(event) => update({ errorSoundEnabled: event.currentTarget.checked })} />Error Sound</label>
        </div></fieldset>

        <button className="primary-action" type="button" onClick={onStart} disabled={!canStart}>Start Chase</button>
      </section>
    </main>
  )
}
