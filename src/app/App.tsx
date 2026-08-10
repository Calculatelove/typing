import { useEffect, useState } from 'react'

import {
  FIXTURE_ARTICLES,
} from '../articles'
import { GameScreen, ResultScreen, SetupScreen } from '../components'
import {
  DEFAULT_GAME_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings,
} from './settings'
import type { GameResult, GameSettings, ResolvedRound } from './types'
import { resolveRoundArticle } from './roundSelection'

type AppPage = 'setup' | 'game' | 'result'

function browserStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function App() {
  const [page, setPage] = useState<AppPage>('setup')
  const [settings, setSettings] = useState<GameSettings>(() =>
    loadSettings(browserStorage(), FIXTURE_ARTICLES),
  )
  const [round, setRound] = useState<ResolvedRound | undefined>(undefined)
  const [result, setResult] = useState<GameResult | undefined>(undefined)
  const [nextRoundId, setNextRoundId] = useState(1)

  useEffect(() => {
    saveSettings(browserStorage(), settings)
  }, [settings])

  const handleSettingsChange = (candidate: GameSettings) => {
    setSettings(normalizeSettings(candidate, FIXTURE_ARTICLES))
  }

  const startRound = () => {
    const article = resolveRoundArticle(settings, FIXTURE_ARTICLES)
    if (article === undefined) return
    setResult(undefined)
    setRound({ id: nextRoundId, settings, article })
    setNextRoundId((value) => value + 1)
    setPage('game')
  }

  const retryRound = () => {
    if (result === undefined) return
    setRound({ id: nextRoundId, settings: result.settings, article: result.article })
    setNextRoundId((value) => value + 1)
    setResult(undefined)
    setPage('game')
  }

  if (page === 'game' && round !== undefined) {
    return <GameScreen key={round.id} round={round} onComplete={(nextResult) => {
      setResult(nextResult)
      setPage('result')
    }} />
  }

  if (page === 'result' && result !== undefined) {
    return <ResultScreen
      result={result}
      onRetry={retryRound}
      onBack={() => {
        setSettings(result.settings)
        setPage('setup')
      }}
    />
  }

  return <SetupScreen
    settings={settings ?? DEFAULT_GAME_SETTINGS}
    articles={FIXTURE_ARTICLES}
    onChange={handleSettingsChange}
    onStart={startRound}
  />
}

export default App
