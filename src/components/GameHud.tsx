interface GameHudProps {
  readonly roleLabel: string
  readonly difficultyLabel: string
  readonly performanceRate: number
  readonly performanceUnit: string
  readonly actualSpeed: number
  readonly targetSpeed: number
  readonly accuracy: number
  readonly combo: number
  readonly errors: number
  readonly progress: number
  readonly phaseLabel: string
  readonly pursuitDistance?: number
}

export function GameHud(props: GameHudProps) {
  return (
    <aside className="game-hud" aria-label="Game HUD">
      <div className="hud-identity"><strong>{props.roleLabel}</strong><span>{props.difficultyLabel}</span></div>
      <dl>
        <div><dt>Performance</dt><dd>{props.performanceRate.toFixed(0)} {props.performanceUnit}</dd></div>
        <div><dt>Vehicle</dt><dd>{props.actualSpeed.toFixed(0)} / {props.targetSpeed.toFixed(0)}</dd></div>
        <div><dt>Accuracy</dt><dd>{(props.accuracy * 100).toFixed(1)}%</dd></div>
        <div><dt>Combo</dt><dd>×{props.combo}</dd></div>
        <div><dt>Errors</dt><dd>{props.errors}</dd></div>
        <div><dt>Progress</dt><dd>{Math.round(props.progress * 100)}%</dd></div>
        <div><dt>Status</dt><dd>{props.phaseLabel}</dd></div>
        {props.pursuitDistance === undefined ? null : <div><dt>Gap</dt><dd>{props.pursuitDistance.toFixed(0)} m</dd></div>}
      </dl>
    </aside>
  )
}
