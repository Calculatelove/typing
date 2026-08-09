import { lerpVector, mod, normalizeVector } from './math'
import type {
  Track,
  TrackBounds,
  TrackDecoration,
  TrackSample,
  Vector2,
} from './types'

const DEFAULT_SAMPLES_PER_SEGMENT = 64
const DEFAULT_ROAD_WIDTH = 72
const DEFAULT_DECORATION_SEED = 2_026_080_9
const MAX_CONTROL_POINT_TURN = Math.PI * (165 / 180)
const MIN_ROAD_SPACING_FACTOR = 1.05

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

function cross(origin: Vector2, first: Vector2, second: Vector2): number {
  return (
    (first.x - origin.x) * (second.y - origin.y) -
    (first.y - origin.y) * (second.x - origin.x)
  )
}

function pointOnSegment(point: Vector2, start: Vector2, end: Vector2): boolean {
  const epsilon = 1e-8
  return (
    point.x >= Math.min(start.x, end.x) - epsilon &&
    point.x <= Math.max(start.x, end.x) + epsilon &&
    point.y >= Math.min(start.y, end.y) - epsilon &&
    point.y <= Math.max(start.y, end.y) + epsilon
  )
}

function segmentsIntersect(
  firstStart: Vector2,
  firstEnd: Vector2,
  secondStart: Vector2,
  secondEnd: Vector2,
): boolean {
  const firstSideStart = cross(firstStart, firstEnd, secondStart)
  const firstSideEnd = cross(firstStart, firstEnd, secondEnd)
  const secondSideStart = cross(secondStart, secondEnd, firstStart)
  const secondSideEnd = cross(secondStart, secondEnd, firstEnd)
  const epsilon = 1e-8

  if (
    ((firstSideStart > epsilon && firstSideEnd < -epsilon) ||
      (firstSideStart < -epsilon && firstSideEnd > epsilon)) &&
    ((secondSideStart > epsilon && secondSideEnd < -epsilon) ||
      (secondSideStart < -epsilon && secondSideEnd > epsilon))
  ) {
    return true
  }

  return (
    (Math.abs(firstSideStart) <= epsilon && pointOnSegment(secondStart, firstStart, firstEnd)) ||
    (Math.abs(firstSideEnd) <= epsilon && pointOnSegment(secondEnd, firstStart, firstEnd)) ||
    (Math.abs(secondSideStart) <= epsilon && pointOnSegment(firstStart, secondStart, secondEnd)) ||
    (Math.abs(secondSideEnd) <= epsilon && pointOnSegment(firstEnd, secondStart, secondEnd))
  )
}

function distanceFromPointToSegment(
  point: Vector2,
  segmentStart: Vector2,
  segmentEnd: Vector2,
): number {
  const segmentX = segmentEnd.x - segmentStart.x
  const segmentY = segmentEnd.y - segmentStart.y
  const squaredLength = segmentX * segmentX + segmentY * segmentY
  if (squaredLength <= Number.EPSILON) {
    return Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y)
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segmentStart.x) * segmentX +
        (point.y - segmentStart.y) * segmentY) / squaredLength,
    ),
  )
  return Math.hypot(
    point.x - (segmentStart.x + segmentX * projection),
    point.y - (segmentStart.y + segmentY * projection),
  )
}

function distanceBetweenSegments(
  firstStart: Vector2,
  firstEnd: Vector2,
  secondStart: Vector2,
  secondEnd: Vector2,
): number {
  if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
    return 0
  }

  return Math.min(
    distanceFromPointToSegment(firstStart, secondStart, secondEnd),
    distanceFromPointToSegment(firstEnd, secondStart, secondEnd),
    distanceFromPointToSegment(secondStart, firstStart, firstEnd),
    distanceFromPointToSegment(secondEnd, firstStart, firstEnd),
  )
}

function validateControlPointTurns(controlPoints: readonly Vector2[]): void {
  for (let index = 0; index < controlPoints.length; index += 1) {
    const previous = controlPointAt(controlPoints, index - 1)
    const current = controlPointAt(controlPoints, index)
    const next = controlPointAt(controlPoints, index + 1)
    const incoming = normalizeVector({ x: current.x - previous.x, y: current.y - previous.y })
    const outgoing = normalizeVector({ x: next.x - current.x, y: next.y - current.y })
    const dot = Math.max(-1, Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y))
    if (Math.acos(dot) > MAX_CONTROL_POINT_TURN) {
      throw new RangeError('道路控制点形成了过尖转角。')
    }
  }
}

function validateNoSelfIntersection(points: readonly CurvePoint[]): void {
  const segmentCount = points.length
  for (let firstIndex = 0; firstIndex < segmentCount; firstIndex += 1) {
    const firstEndIndex = (firstIndex + 1) % segmentCount
    for (let secondIndex = firstIndex + 1; secondIndex < segmentCount; secondIndex += 1) {
      const secondEndIndex = (secondIndex + 1) % segmentCount
      const segmentsAreAdjacent = (
        firstEndIndex === secondIndex ||
        secondEndIndex === firstIndex
      )
      if (segmentsAreAdjacent) {
        continue
      }
      if (
        segmentsIntersect(
          points[firstIndex]!.position,
          points[firstEndIndex]!.position,
          points[secondIndex]!.position,
          points[secondEndIndex]!.position,
        )
      ) {
        throw new RangeError('道路中心线不能自交。')
      }
    }
  }
}

export function validateSampledRoadSpacing(
  samples: readonly TrackSample[],
  length: number,
  roadWidth: number,
): void {
  const segmentCount = samples.length - 1
  const localArcDistance = roadWidth * 2.5
  const minimumSpacing = roadWidth * MIN_ROAD_SPACING_FACTOR

  for (let firstIndex = 0; firstIndex < segmentCount; firstIndex += 1) {
    const firstStart = samples[firstIndex]!
    const firstEnd = samples[firstIndex + 1]!
    const firstMiddleDistance = (firstStart.distance + firstEnd.distance) / 2
    for (let secondIndex = firstIndex + 1; secondIndex < segmentCount; secondIndex += 1) {
      const firstEndIndex = (firstIndex + 1) % segmentCount
      const secondEndIndex = (secondIndex + 1) % segmentCount
      if (firstEndIndex === secondIndex || secondEndIndex === firstIndex) {
        continue
      }

      const secondStart = samples[secondIndex]!
      const secondEnd = samples[secondIndex + 1]!
      const secondMiddleDistance = (secondStart.distance + secondEnd.distance) / 2
      const forwardArcDistance = secondMiddleDistance - firstMiddleDistance
      const shortestArcDistance = Math.min(forwardArcDistance, length - forwardArcDistance)
      if (shortestArcDistance <= localArcDistance) {
        continue
      }
      if (
        distanceBetweenSegments(
          firstStart.position,
          firstEnd.position,
          secondStart.position,
          secondEnd.position,
        ) < minimumSpacing
      ) {
        throw new RangeError('不相邻路段间距小于道路安全宽度。')
      }
    }
  }
}

function seededUnit(seed: number, index: number): number {
  let value = (seed ^ Math.imul(index + 1, 0x9e37_79b1)) >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  return (value >>> 0) / 0x1_0000_0000
}

function decorationAt(
  sample: TrackSample,
  id: string,
  kind: TrackDecoration['kind'],
  side: 1 | -1,
  offset: number,
  variant: number,
  scale: number,
): TrackDecoration {
  return {
    id,
    kind,
    position: {
      x: sample.position.x + sample.normal.x * side * offset,
      y: sample.position.y + sample.normal.y * side * offset,
    },
    heading: sample.heading,
    variant,
    scale,
  }
}

function createDecorations(
  samples: readonly TrackSample[],
  roadWidth: number,
  seed: number,
): readonly TrackDecoration[] {
  const decorations: TrackDecoration[] = []
  const closingSampleIndex = samples.length - 1
  const spacing = Math.max(24, Math.floor(closingSampleIndex / 28))
  let decorationIndex = 0

  for (let sampleIndex = 0; sampleIndex < closingSampleIndex; sampleIndex += spacing) {
    const sample = samples[sampleIndex]!
    const random = seededUnit(seed, decorationIndex)
    const side: 1 | -1 = random < 0.5 ? 1 : -1
    const kind: TrackDecoration['kind'] = decorationIndex % 3 === 0 ? 'building' : 'tree'
    const variant = Math.floor(seededUnit(seed, decorationIndex + 101) * 4)
    const scale = 0.88 + seededUnit(seed, decorationIndex + 211) * 0.24
    const mainOffset = kind === 'building' ? roadWidth * 1.75 : roadWidth * 1.25
    decorations.push(
      decorationAt(
        sample,
        `roadside-${decorationIndex}`,
        kind,
        side,
        mainOffset,
        variant,
        scale,
      ),
      decorationAt(
        sample,
        `light-${decorationIndex}`,
        'streetLight',
        side === 1 ? -1 : 1,
        roadWidth * 0.82,
        variant,
        0.9 + seededUnit(seed, decorationIndex + 307) * 0.2,
      ),
    )
    decorationIndex += 1
  }

  return decorations
}

export function createClosedTrack(
  controlPoints: readonly Vector2[],
  options: {
    readonly samplesPerSegment?: number
    readonly roadWidth?: number
    readonly decorationSeed?: number
  } = {},
): Track {
  if (controlPoints.length < 4) {
    throw new RangeError('闭合道路至少需要 4 个控制点。')
  }
  if (controlPoints.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new RangeError('道路控制点坐标必须是有限数。')
  }

  const samplesPerSegment = options.samplesPerSegment ?? DEFAULT_SAMPLES_PER_SEGMENT
  const roadWidth = options.roadWidth ?? DEFAULT_ROAD_WIDTH
  const decorationSeed = options.decorationSeed ?? DEFAULT_DECORATION_SEED
  if (!Number.isInteger(samplesPerSegment) || samplesPerSegment < 8) {
    throw new RangeError('每段采样数必须是至少为 8 的整数。')
  }
  if (!Number.isFinite(roadWidth) || roadWidth <= 0) {
    throw new RangeError('道路宽度必须是有限正数。')
  }
  if (!Number.isSafeInteger(decorationSeed)) {
    throw new RangeError('装饰 seed 必须是安全整数。')
  }
  validateControlPointTurns(controlPoints)

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
  validateNoSelfIntersection(curvePoints)
  validateSampledRoadSpacing(samples, cumulativeDistance, roadWidth)

  return {
    controlPoints: controlPoints.map((point) => ({ ...point })),
    samples,
    length: cumulativeDistance,
    roadWidth,
    bounds: boundsFor(curvePoints),
    decorationSeed,
    decorations: createDecorations(samples, roadWidth, decorationSeed),
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
