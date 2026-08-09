import { lerpVector, mod, normalizeVector } from './math'
import type { Track, TrackBounds, TrackSample, Vector2 } from './types'

const DEFAULT_SAMPLES_PER_SEGMENT = 64
const DEFAULT_ROAD_WIDTH = 72

export const DEFAULT_TRACK_CONTROL_POINTS: readonly Vector2[] = [
  { x: -520, y: -80 },
  { x: -420, y: -330 },
  { x: -120, y: -430 },
  { x: 100, y: -300 },
  { x: 390, y: -380 },
  { x: 560, y: -120 },
  { x: 430, y: 130 },
  { x: 510, y: 360 },
  { x: 180, y: 430 },
  { x: -40, y: 300 },
  { x: -330, y: 420 },
  { x: -560, y: 180 },
]

interface CurvePoint {
  readonly position: Vector2
  readonly tangent: Vector2
}

function controlPointAt(controlPoints: readonly Vector2[], index: number): Vector2 {
  return controlPoints[mod(index, controlPoints.length)]!
}

function sampleCatmullRom(
  p0: Vector2,
  p1: Vector2,
  p2: Vector2,
  p3: Vector2,
  t: number,
): CurvePoint {
  const t2 = t * t
  const t3 = t2 * t
  const position = {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  }
  const derivative = {
    x:
      0.5 *
      (-p0.x +
        p2.x +
        2 * (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t +
        3 * (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t2),
    y:
      0.5 *
      (-p0.y +
        p2.y +
        2 * (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t +
        3 * (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t2),
  }

  return {
    position,
    tangent: normalizeVector(derivative, normalizeVector({ x: p2.x - p1.x, y: p2.y - p1.y })),
  }
}

function boundsFor(points: readonly CurvePoint[]): TrackBounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const { position } of points) {
    minX = Math.min(minX, position.x)
    minY = Math.min(minY, position.y)
    maxX = Math.max(maxX, position.x)
    maxY = Math.max(maxY, position.y)
  }

  return { minX, minY, maxX, maxY }
}

function toTrackSample(point: CurvePoint, distance: number): TrackSample {
  const tangent = normalizeVector(point.tangent)
  return {
    distance,
    position: point.position,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    heading: Math.atan2(tangent.y, tangent.x),
  }
}

export function createClosedTrack(
  controlPoints: readonly Vector2[],
  options: { readonly samplesPerSegment?: number; readonly roadWidth?: number } = {},
): Track {
  if (controlPoints.length < 4) {
    throw new RangeError('闭合道路至少需要 4 个控制点。')
  }
  if (controlPoints.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new RangeError('道路控制点坐标必须是有限数。')
  }

  const samplesPerSegment = options.samplesPerSegment ?? DEFAULT_SAMPLES_PER_SEGMENT
  const roadWidth = options.roadWidth ?? DEFAULT_ROAD_WIDTH
  if (!Number.isInteger(samplesPerSegment) || samplesPerSegment < 8) {
    throw new RangeError('每段采样数必须是至少为 8 的整数。')
  }
  if (!Number.isFinite(roadWidth) || roadWidth <= 0) {
    throw new RangeError('道路宽度必须是有限正数。')
  }

  const curvePoints: CurvePoint[] = []
  for (let segment = 0; segment < controlPoints.length; segment += 1) {
    const p0 = controlPointAt(controlPoints, segment - 1)
    const p1 = controlPointAt(controlPoints, segment)
    const p2 = controlPointAt(controlPoints, segment + 1)
    const p3 = controlPointAt(controlPoints, segment + 2)
    for (let sampleIndex = 0; sampleIndex < samplesPerSegment; sampleIndex += 1) {
      curvePoints.push(
        sampleCatmullRom(p0, p1, p2, p3, sampleIndex / samplesPerSegment),
      )
    }
  }

  const samples: TrackSample[] = []
  let cumulativeDistance = 0
  samples.push(toTrackSample(curvePoints[0]!, cumulativeDistance))
  for (let index = 1; index < curvePoints.length; index += 1) {
    const previous = curvePoints[index - 1]!.position
    const current = curvePoints[index]!.position
    cumulativeDistance += Math.hypot(current.x - previous.x, current.y - previous.y)
    samples.push(toTrackSample(curvePoints[index]!, cumulativeDistance))
  }

  const first = curvePoints[0]!
  const last = curvePoints.at(-1)!
  cumulativeDistance += Math.hypot(
    first.position.x - last.position.x,
    first.position.y - last.position.y,
  )
  if (cumulativeDistance <= Number.EPSILON) {
    throw new RangeError('道路总弧长必须大于零。')
  }
  samples.push(toTrackSample(first, cumulativeDistance))

  return {
    controlPoints: controlPoints.map((point) => ({ ...point })),
    samples,
    length: cumulativeDistance,
    roadWidth,
    bounds: boundsFor(curvePoints),
  }
}

export function createDefaultTrack(): Track {
  return createClosedTrack(DEFAULT_TRACK_CONTROL_POINTS)
}

export function sampleTrackAt(track: Track, distance: number): TrackSample {
  const normalizedDistance = mod(distance, track.length)
  let lowerIndex = 0
  let upperIndex = track.samples.length - 1

  while (lowerIndex + 1 < upperIndex) {
    const middleIndex = Math.floor((lowerIndex + upperIndex) / 2)
    if (track.samples[middleIndex]!.distance <= normalizedDistance) {
      lowerIndex = middleIndex
    } else {
      upperIndex = middleIndex
    }
  }

  const lower = track.samples[lowerIndex]!
  const upper = track.samples[upperIndex]!
  const segmentLength = upper.distance - lower.distance
  const amount = segmentLength <= Number.EPSILON
    ? 0
    : (normalizedDistance - lower.distance) / segmentLength
  const tangent = normalizeVector(lerpVector(lower.tangent, upper.tangent, amount), lower.tangent)

  return {
    distance: normalizedDistance,
    position: lerpVector(lower.position, upper.position, amount),
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    heading: Math.atan2(tangent.y, tangent.x),
  }
}
