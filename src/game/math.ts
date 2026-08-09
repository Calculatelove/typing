import type { Vector2 } from './types'

export function mod(value: number, modulus: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError('待取模的值必须是有限数。')
  }
  if (!Number.isFinite(modulus) || modulus <= 0) {
    throw new RangeError('模数必须是有限正数。')
  }

  return ((value % modulus) + modulus) % modulus
}

export function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

export function lerpVector(start: Vector2, end: Vector2, amount: number): Vector2 {
  return {
    x: lerp(start.x, end.x, amount),
    y: lerp(start.y, end.y, amount),
  }
}

export function normalizeVector(vector: Vector2, fallback: Vector2 = { x: 1, y: 0 }): Vector2 {
  const length = Math.hypot(vector.x, vector.y)
  if (length <= Number.EPSILON) {
    return fallback
  }

  return { x: vector.x / length, y: vector.y / length }
}
