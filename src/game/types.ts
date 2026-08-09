export interface Vector2 {
  readonly x: number
  readonly y: number
}

export type Direction = 1 | -1

export type VehicleRole = 'police' | 'thief'

export interface TrackSample {
  readonly distance: number
  readonly position: Vector2
  readonly tangent: Vector2
  readonly normal: Vector2
  readonly heading: number
}

export interface TrackBounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export type TrackDecorationKind = 'building' | 'tree' | 'streetLight'

export interface TrackDecoration {
  readonly id: string
  readonly kind: TrackDecorationKind
  readonly position: Vector2
  readonly heading: number
  readonly variant: number
  readonly scale: number
}

export interface Track {
  readonly controlPoints: readonly Vector2[]
  readonly samples: readonly TrackSample[]
  readonly length: number
  readonly roadWidth: number
  readonly bounds: TrackBounds
  readonly decorationSeed: number
  readonly decorations: readonly TrackDecoration[]
}

export interface VehicleState {
  readonly role: VehicleRole
  readonly trackPosition: number
  readonly speed: number
  readonly direction: Direction
  readonly worldPosition: Vector2
  readonly heading: number
}

export interface PursuitConfig {
  readonly catchDistance: number
  readonly reverseThreshold: number
  readonly reverseHysteresis: number
  readonly reverseCooldownSeconds: number
  readonly maxDeltaSeconds: number
}

export interface PursuitState {
  readonly police: VehicleState
  readonly thief: VehicleState
  readonly captured: boolean
  readonly reverseArmed: boolean
  readonly reverseCooldownRemaining: number
  readonly reverseCount: number
}
