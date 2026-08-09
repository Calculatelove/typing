import type { Track, TrackBounds, Vector2 } from './types'
import { VEHICLE_VISUAL } from './worldConfig'

export interface Viewport { readonly width: number; readonly height: number }
export interface CameraState { readonly position: Vector2; readonly zoom: number }
export interface CanvasResolution {
  readonly viewport: Viewport
  readonly pixelWidth: number
  readonly pixelHeight: number
  readonly pixelRatio: number
}

export const DEFAULT_PROJECTION = {
  verticalScale: 0.72,
  shearX: 0.16,
  heightVector: { x: -0.28, y: -1 },
} as const

export function getCanvasResolution(width: number, height: number, pixelRatio: number): CanvasResolution {
  const viewport = {
    width: Math.max(1, width),
    height: Math.max(1, height),
  }
  const safePixelRatio = Math.min(2, Math.max(1, Number.isFinite(pixelRatio) ? pixelRatio : 1))
  return {
    viewport,
    pixelWidth: Math.round(viewport.width * safePixelRatio),
    pixelHeight: Math.round(viewport.height * safePixelRatio),
    pixelRatio: safePixelRatio,
  }
}

function projectWithoutCamera(world: Vector2, height = 0): Vector2 {
  return {
    x: world.x + world.y * DEFAULT_PROJECTION.shearX + height * DEFAULT_PROJECTION.heightVector.x,
    y: world.y * DEFAULT_PROJECTION.verticalScale + height * DEFAULT_PROJECTION.heightVector.y,
  }
}

export function projectWorldPoint(world: Vector2, camera: CameraState, viewport: Viewport, height = 0): Vector2 {
  const relativeX = world.x - camera.position.x
  const relativeY = world.y - camera.position.y
  return {
    x: viewport.width / 2 + camera.zoom * (
      relativeX + relativeY * DEFAULT_PROJECTION.shearX + height * DEFAULT_PROJECTION.heightVector.x
    ),
    y: viewport.height / 2 + camera.zoom * (
      relativeY * DEFAULT_PROJECTION.verticalScale + height * DEFAULT_PROJECTION.heightVector.y
    ),
  }
}
export function projectWorldBounds(bounds: TrackBounds): TrackBounds {
  const points = [
    { x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY }, { x: bounds.minX, y: bounds.maxY },
  ].map(({ x, y }) => ({ x: x + y * DEFAULT_PROJECTION.shearX, y: y * DEFAULT_PROJECTION.verticalScale }))
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

function boundsForProjectedPoints(points: readonly Vector2[]): TrackBounds {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

function appendProjectedBox(
  points: Vector2[],
  center: Vector2,
  radius: number,
  height: number,
): void {
  for (const offsetX of [-radius, radius]) {
    for (const offsetY of [-radius, radius]) {
      const world = { x: center.x + offsetX, y: center.y + offsetY }
      points.push(projectWithoutCamera(world), projectWithoutCamera(world, height))
    }
  }
}

export function computeSceneProjectedBounds(track: Track): TrackBounds {
  const points: Vector2[] = []
  const roadExtent = track.roadWidth * 0.65 + 18
  const trackCenter = {
    x: (track.bounds.minX + track.bounds.maxX) / 2,
    y: (track.bounds.minY + track.bounds.maxY) / 2,
  }
  const trackRadius = Math.max(
    track.bounds.maxX - track.bounds.minX,
    track.bounds.maxY - track.bounds.minY,
  ) / 2 + roadExtent
  appendProjectedBox(points, trackCenter, trackRadius, VEHICLE_VISUAL.riderHeight + 14)

  for (const decoration of track.decorations) {
    if (decoration.kind === 'building') {
      const width = (105 + decoration.variant * 14) * decoration.scale
      const depth = (78 + (decoration.variant % 2) * 22) * decoration.scale
      const height = (105 + decoration.variant * 25) * decoration.scale
      appendProjectedBox(points, decoration.position, Math.hypot(width, depth) / 2, height)
    } else if (decoration.kind === 'tree') {
      appendProjectedBox(points, decoration.position, 34 * decoration.scale, 90 * decoration.scale)
    } else {
      appendProjectedBox(points, decoration.position, 24 * decoration.scale, 88 * decoration.scale)
    }
  }
  return boundsForProjectedPoints(points)
}
export function computePlayZoom(bounds: TrackBounds, viewport: Viewport): number {
  const width = Math.max(1, bounds.maxX - bounds.minX)
  const height = Math.max(1, bounds.maxY - bounds.minY)
  return Math.max(0.45, Math.min(1.4, Math.max(
    viewport.width / (width * 0.4),
    viewport.height / (height * 0.42),
  )))
}
export function computeOverviewCamera(bounds: TrackBounds, viewport: Viewport, padding = 56): CameraState {
  const projected = projectWorldBounds(bounds)
  return computeOverviewCameraFromProjectedBounds(projected, viewport, padding)
}

function computeOverviewCameraFromProjectedBounds(
  projected: TrackBounds,
  viewport: Viewport,
  padding: number,
): CameraState {
  const availableWidth = Math.max(1, viewport.width - padding * 2)
  const availableHeight = Math.max(1, viewport.height - padding * 2)
  const zoom = Math.min(
    availableWidth / Math.max(1, projected.maxX - projected.minX),
    availableHeight / Math.max(1, projected.maxY - projected.minY),
  )
  const projectedCenter = {
    x: (projected.minX + projected.maxX) / 2,
    y: (projected.minY + projected.maxY) / 2,
  }
  const cameraY = projectedCenter.y / DEFAULT_PROJECTION.verticalScale
  return {
    position: {
      x: projectedCenter.x - cameraY * DEFAULT_PROJECTION.shearX,
      y: cameraY,
    },
    zoom: Math.max(0.05, zoom),
  }
}

export function computeSceneOverviewCamera(track: Track, viewport: Viewport, padding = 56): CameraState {
  return computeOverviewCameraFromProjectedBounds(computeSceneProjectedBounds(track), viewport, padding)
}
