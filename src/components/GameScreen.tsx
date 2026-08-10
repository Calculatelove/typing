import type { GameResult, ResolvedRound } from '../app/types'
import { useGameRound } from '../app/useGameRound'
import { PLAYER_POLICE } from '../game/gameSession'
import { ArticleDisplay } from './ArticleDisplay'
import { GameHud } from './GameHud'

interface GameScreenProps {
  readonly round: ResolvedRound
  readonly onComplete: (result: GameResult) => void
}

const DIFFICULTY_LABEL = { easy: 'Easy', normal: 'Normal', hard: 'Hard', shadow: 'Shadow' } as const
const PHASE_LABEL = { setup: 'Setup', ready: 'Ready — start typing', running: 'Running', won: 'Victory', lost: 'Defeat' } as const

export function GameScreen({ round, onComplete }: GameScreenProps) {
  const game = useGameRound(round, onComplete)
  const progress = game.typing.targetGraphemes.length === 0
    ? 1
    : game.typing.correctIndex / game.typing.targetGraphemes.length
  const roleLabel = round.settings.playerRole === PLAYER_POLICE ? 'Police' : 'Thief'

  return (
    <main className="game-screen">
      <section className="game-stage">
        <canvas ref={game.canvasRef} aria-label="Typing Gaming game world" />
        <GameHud
          roleLabel={roleLabel}
          difficultyLabel={DIFFICULTY_LABEL[round.settings.difficulty]}
          performanceRate={game.hud.performanceRate}
          performanceUnit={round.settings.language === 'english' ? 'WPM' : '字/分钟'}
          actualSpeed={game.hud.actualSpeed}
          targetSpeed={game.hud.targetSpeed}
          accuracy={game.hud.accuracy}
          combo={game.hud.combo}
          errors={game.hud.errors}
          progress={progress}
          phaseLabel={PHASE_LABEL[game.session.phase]}
          pursuitDistance={game.hud.pursuitDistance}
        />
      </section>
      <section className="typing-panel" onClick={() => game.inputRef.current?.focus()}>
        <div className="typing-panel__heading">
          <div><p className="eyebrow">Now typing</p><h1>{round.article.title}</h1></div>
          <span>{game.hud.idle && game.session.phase === 'running' ? 'Keep typing' : PHASE_LABEL[game.session.phase]}</span>
        </div>
        <ArticleDisplay typing={game.typing} errorPulse={game.errorPulse} />
        <textarea
          ref={game.inputRef}
          className="typing-capture"
          aria-label="文章输入"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          onBeforeInput={game.handleBeforeInput}
          onInput={game.handleInput}
          onCompositionStart={game.handleCompositionStart}
          onCompositionUpdate={game.handleCompositionUpdate}
          onCompositionEnd={game.handleCompositionEnd}
        />
        <p className="typing-help">保持输入框焦点；中文拼音在确认上屏前不会计分。</p>
      </section>
    </main>
  )
}
