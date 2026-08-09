import type { PursuitState, Track, TrackDecoration, VehicleState } from './types'

export interface DebugViewport {
  readonly width: number
  readonly height: number
}

interface CameraTransform {
  readonly centerX: number
  readonly centerY: number
  readonly scale: number
}

function createCamera(track: Track, viewport: DebugViewport): CameraTransform {
  const worldWidth = track.bounds.maxX - track.bounds.minX + track.roadWidth * 5
  const worldHeight = track.bounds.maxY - track.bounds.minY + track.roadWidth * 5
  return {
    centerX: (track.bounds.minX + track.bounds.maxX) / 2,
    centerY: (track.bounds.minY + track.bounds.maxY) / 2,
    scale: Math.min(viewport.width / worldWidth, viewport.height / worldHeight),
  }
}

function traceTrack(context: CanvasRenderingContext2D, track: Track): void {
  context.beginPath()
  for (let index = 0; index < track.samples.length; index += 1) {
    const { position } = track.samples[index]!
    if (index === 0) {
      context.moveTo(position.x, position.y)
    } else {
      context.lineTo(position.x, position.y)
    }
  }
  context.closePath()
}

function roundedRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.arcTo(x + width, y, x + width, y + height, safeRadius)
  context.arcTo(x + width, y + height, x, y + height, safeRadius)
  context.arcTo(x, y + height, x, y, safeRadius)
  context.arcTo(x, y, x + width, y, safeRadius)
  context.closePath()
}

function withDecorationTransform(
  context: CanvasRenderingContext2D,
  decoration: TrackDecoration,
  draw: () => void,
): void {
  context.save()
  context.translate(decoration.position.x, decoration.position.y)
  context.rotate(decoration.heading)
  context.scale(decoration.scale, decoration.scale)
  draw()
  context.restore()
}

function drawBuilding(
  context: CanvasRenderingContext2D,
  decoration: TrackDecoration,
): void {
  const width = 54 + (decoration.variant % 3) * 14
  const height = 42 + (decoration.variant % 4) * 10
  withDecorationTransform(context, decoration, () => {
    roundedRectangle(context, -width / 2, -height / 2, width, height, 7)
    context.fillStyle = ['#d9aa76', '#c98572', '#8aa6a3', '#bda5d2'][decoration.variant % 4]!
    context.fill()
    context.strokeStyle = '#243b46'
    context.lineWidth = 3
    context.stroke()

    context.fillStyle = '#f5df9d'
    const windowY = -height / 2 + 11
    for (const windowX of [-width * 0.22, width * 0.22]) {
      context.fillRect(windowX - 4, windowY, 8, 7)
    }
    context.fillStyle = '#4a6872'
    context.fillRect(-5, height / 2 - 14, 10, 14)
  })
}

function drawTree(
  context: CanvasRenderingContext2D,
  decoration: TrackDecoration,
): void {
  withDecorationTransform(context, decoration, () => {
    context.fillStyle = '#6d4931'
    context.fillRect(-3, -2, 6, 18)
    context.beginPath()
    context.arc(0, -8, 15, 0, Math.PI * 2)
    context.fillStyle = '#4f8b62'
    context.fill()
    context.beginPath()
    context.arc(-8, -4, 8, 0, Math.PI * 2)
    context.arc(8, -4, 8, 0, Math.PI * 2)
    context.fillStyle = '#6faa73'
    context.fill()
  })
}

function drawStreetLight(
  context: CanvasRenderingContext2D,
  decoration: TrackDecoration,
): void {
  withDecorationTransform(context, decoration, () => {
    context.strokeStyle = '#344b56'
    context.lineWidth = 3
    context.beginPath()
    context.moveTo(0, 11)
    context.lineTo(0, -16)
    context.lineTo(8, -16)
    context.stroke()
    context.beginPath()
    context.arc(10, -14, 5, 0, Math.PI * 2)
    context.fillStyle = '#ffe39c'
    context.fill()
  })
}

function drawDecorations(context: CanvasRenderingContext2D, track: Track): void {
  for (const decoration of track.decorations) {
    if (decoration.kind === 'building') {
      drawBuilding(context, decoration)
    } else if (decoration.kind === 'tree') {
      drawTree(context, decoration)
    } else {
      drawStreetLight(context, decoration)
    }
  }
}

function drawRoad(context: CanvasRenderingContext2D, track: Track): void {
  context.lineCap = 'round'
  context.lineJoin = 'round'

  traceTrack(context, track)
  context.strokeStyle = '#c7d2d0'
  context.lineWidth = track.roadWidth + 18
  context.stroke()

  traceTrack(context, track)
  context.strokeStyle = '#33434c'
  context.lineWidth = track.roadWidth
  context.stroke()

  context.save()
  context.setLineDash([18, 17])
  traceTrack(context, track)
  context.strokeStyle = '#e3d89a'
  context.lineWidth = 3
  context.stroke()
  context.restore()
}

function drawVehicle(context: CanvasRenderingContext2D, vehicle: VehicleState): void {
  const isPolice = vehicle.role === 'police'
  context.save()
  context.translate(vehicle.worldPosition.x, vehicle.worldPosition.y)
  context.rotate(vehicle.heading)

  context.fillStyle = '#17242b'
  for (const wheelX of [-12, 12]) {
    for (const wheelY of [-10, 10]) {
      roundedRectangle(context, wheelX - 5, wheelY - 3, 10, 6, 2)
      context.fill()
    }
  }

  roundedRectangle(context, -20, -11, 40, 22, 8)
  context.fillStyle = isPolice ? '#3ca8cf' : '#e57b45'
  context.fill()
  context.strokeStyle = '#142c36'
  context.lineWidth = 2.5
  context.stroke()

  roundedRectangle(context, -7, -8, 15, 16, 4)
  context.fillStyle = '#dff5f5'
  context.fill()

  context.strokeStyle = isPolice ? '#f1f8fb' : '#ffe2a3'
  context.lineWidth = 2.5
  context.beginPath()
  context.moveTo(-3, 6)
  context.lineTo(2, 0)
  context.lineTo(-1, 0)
  context.lineTo(4, -6)
  context.stroke()

  if (isPolice) {
    context.fillStyle = '#ee5e63'
    context.fillRect(-5, -14, 5, 4)
    context.fillStyle = '#63d0ec'
    context.fillRect(0, -14, 5, 4)
  }

  context.fillStyle = '#fff3ca'
  context.beginPath()
  context.arc(19, 0, 3.5, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

export function renderDebugScene(
  context: CanvasRenderingContext2D,
  track: Track,
  state: PursuitState,
  viewport: DebugViewport,
): void {
  const camera = createCamera(track, viewport)
  const background = context.createLinearGradient(0, 0, 0, viewport.height)
  background.addColorStop(0, '#d7ebe4')
  background.addColorStop(1, '#b8d3c7')

  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, viewport.width, viewport.height)
  context.fillStyle = background
  context.fillRect(0, 0, viewport.width, viewport.height)

  context.save()
  context.translate(viewport.width / 2, viewport.height / 2)
  context.scale(camera.scale, camera.scale)
  context.translate(-camera.centerX, -camera.centerY)
  drawDecorations(context, track)
  drawRoad(context, track)
  drawVehicle(context, state.police)
  drawVehicle(context, state.thief)
  context.restore()
}
