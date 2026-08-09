import { describe, expect, it } from 'vitest'

import {
  computeSceneOverviewCamera,
  computeSceneProjectedBounds,
  computeOverviewCamera,
  computePlayZoom,
  getCanvasResolution,
  projectWorldBounds,
  projectWorldPoint,
} from './projection'
import { createDefaultTrack } from './track'

describe('2.5D 斜投影', () => {
  it('把摄像机原点投到中心并斜压世界 Y', () => {
    const camera = { position: { x: 10, y: 20 }, zoom: 2 }
    const viewport = { width: 800, height: 600 }
    expect(projectWorldPoint({ x: 10, y: 20 }, camera, viewport)).toEqual({ x: 400, y: 300 })
    expect(projectWorldPoint({ x: 10, y: 120 }, camera, viewport)).toEqual({ x: 432, y: 444 })
  })

  it('高度只把屏幕点向左上提升且不修改世界坐标', () => {
    const world = { x: 100, y: 50 }
    const ground = projectWorldPoint(world, { position: { x: 0, y: 0 }, zoom: 1 }, { width: 800, height: 600 })
    const top = projectWorldPoint(world, { position: { x: 0, y: 0 }, zoom: 1 }, { width: 800, height: 600 }, 80)
    expect(top.x).toBeCloseTo(ground.x - 22.4, 8)
    expect(top.y).toBeCloseTo(ground.y - 80, 8)
    expect(world).toEqual({ x: 100, y: 50 })
  })

  it('Play zoom 显著大于全图 zoom', () => {
    const bounds = { minX: -1400, minY: -1000, maxX: 1400, maxY: 1000 }
    const viewport = { width: 1200, height: 750 }
    const projected = projectWorldBounds(bounds)
    const play = computePlayZoom(projected, viewport)
    const overview = computeOverviewCamera(bounds, viewport).zoom
    expect(play).toBeGreaterThan(overview * 2)
    expect(viewport.width / play).toBeLessThanOrEqual((projected.maxX - projected.minX) * 0.45)
  })

  it('设备像素比只改变 backing store，不改变摄像机逻辑视口', () => {
    const normal = getCanvasResolution(960, 600, 1)
    const retina = getCanvasResolution(960, 600, 2)

    expect(retina.viewport).toEqual(normal.viewport)
    expect(retina.pixelWidth).toBe(normal.pixelWidth * 2)
    expect(retina.pixelHeight).toBe(normal.pixelHeight * 2)
    expect(computePlayZoom(
      { minX: -1400, minY: -1000, maxX: 1400, maxY: 1000 },
      retina.viewport,
    )).toBe(computePlayZoom(
      { minX: -1400, minY: -1000, maxX: 1400, maxY: 1000 },
      normal.viewport,
    ))
  })

  it('全图摄像机容纳道路外侧装饰与高度投影', () => {
    const track = createDefaultTrack()
    const viewport = { width: 1200, height: 750 }
    const padding = 56
    const bounds = computeSceneProjectedBounds(track)
    const camera = computeSceneOverviewCamera(track, viewport, padding)
    const cameraProjectedX = camera.position.x + camera.position.y * 0.16
    const cameraProjectedY = camera.position.y * 0.72
    const screen = {
      left: viewport.width / 2 + (bounds.minX - cameraProjectedX) * camera.zoom,
      right: viewport.width / 2 + (bounds.maxX - cameraProjectedX) * camera.zoom,
      top: viewport.height / 2 + (bounds.minY - cameraProjectedY) * camera.zoom,
      bottom: viewport.height / 2 + (bounds.maxY - cameraProjectedY) * camera.zoom,
    }

    expect(screen.left).toBeGreaterThanOrEqual(padding - 0.001)
    expect(screen.right).toBeLessThanOrEqual(viewport.width - padding + 0.001)
    expect(screen.top).toBeGreaterThanOrEqual(padding - 0.001)
    expect(screen.bottom).toBeLessThanOrEqual(viewport.height - padding + 0.001)
  })
})
