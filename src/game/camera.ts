import type { PursuitState, Track, Vector2 } from './types'
import type { CameraState, Viewport } from './projection'
import { computePlayZoom, projectWorldBounds, DEFAULT_PROJECTION } from './projection'

export type CameraMode = 'followThief' | 'followPolice' | 'overview'
export type FollowCameraMode = Exclude<CameraMode, 'overview'>

export function getPlayCameraTarget(state: PursuitState, mode: FollowCameraMode, viewport: Viewport, zoom: number): Vector2 {
  const player = mode === 'followThief' ? state.thief : state.police
  const other = mode === 'followThief' ? state.police : state.thief
  const safeZoom = Math.max(0.05, zoom)
  const visibleHeight = viewport.height / safeZoom / DEFAULT_PROJECTION.verticalScale
  const speedRatio = Math.max(0, Math.min(1, player.speed / 800))
  const lookAhead = visibleHeight * (0.16 + speedRatio * 0.08)
  let target = {
    x: player.worldPosition.x + Math.cos(player.heading) * lookAhead,
    y: player.worldPosition.y + Math.sin(player.heading) * lookAhead,
  }
  const distance = Math.hypot(
    other.worldPosition.x - player.worldPosition.x,
    other.worldPosition.y - player.worldPosition.y,
  )
  const compositionRange = viewport.width / safeZoom * 0.65
  if (distance < compositionRange) {
    const blend = 0.35 * (1 - distance / compositionRange)
    const midpoint = {
      x: (player.worldPosition.x + other.worldPosition.x) / 2,
      y: (player.worldPosition.y + other.worldPosition.y) / 2,
    }
    target = {
      x: target.x + (midpoint.x - target.x) * blend,
      y: target.y + (midpoint.y - target.y) * blend,
    }
  }
  return target
}
export function createPlayCamera(track: Track, state: PursuitState, mode: FollowCameraMode, viewport: Viewport): CameraState {
  const zoom = computePlayZoom(projectWorldBounds(track.bounds), viewport)
  return { position: getPlayCameraTarget(state, mode, viewport, zoom), zoom }
}
export function updatePlayCamera(camera: CameraState, track: Track, state: PursuitState, mode: FollowCameraMode, viewport: Viewport, deltaSeconds: number): CameraState {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return camera
  const safeDelta = Math.min(deltaSeconds, 0.1)
  const zoom = computePlayZoom(projectWorldBounds(track.bounds), viewport)
  const target = getPlayCameraTarget(state, mode, viewport, zoom)
  const amount = 1 - Math.exp(-safeDelta / 0.32)
  return {
    position: {
      x: camera.position.x + (target.x - camera.position.x) * amount,
      y: camera.position.y + (target.y - camera.position.y) * amount,
    },
    zoom,
  }
}
