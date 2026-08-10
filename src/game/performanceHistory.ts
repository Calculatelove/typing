export interface PerformanceSample {
  readonly timestamp: number
  readonly rate: number
}

export interface PerformanceHistory {
  readonly samples: readonly PerformanceSample[]
}

const HISTORY_RETENTION_SECONDS = 6

function isValidSample(sample: PerformanceSample): boolean {
  return Number.isFinite(sample.timestamp)
    && sample.timestamp >= 0
    && Number.isFinite(sample.rate)
    && sample.rate >= 0
}

function normalizeSamples(
  samples: readonly PerformanceSample[],
): readonly PerformanceSample[] {
  const sorted = [...samples]
    .filter(isValidSample)
    .sort((left, right) => left.timestamp - right.timestamp)
  const normalized: PerformanceSample[] = []
  for (const sample of sorted) {
    if (normalized.at(-1)?.timestamp === sample.timestamp) {
      normalized[normalized.length - 1] = sample
    } else {
      normalized.push(sample)
    }
  }
  return normalized
}

export function createPerformanceHistory(
  samples: readonly PerformanceSample[] = [],
): PerformanceHistory {
  return { samples: normalizeSamples(samples) }
}

export function appendPerformanceSample(
  history: PerformanceHistory,
  sample: PerformanceSample,
  now: number,
): PerformanceHistory {
  if (!isValidSample(sample) || !Number.isFinite(now) || sample.timestamp > now) {
    return history
  }
  const lastTimestamp = history.samples.at(-1)?.timestamp
  if (lastTimestamp !== undefined && sample.timestamp < lastTimestamp) return history

  const samples = lastTimestamp === sample.timestamp
    ? [...history.samples.slice(0, -1), sample]
    : [...history.samples, sample]
  const cutoff = now - HISTORY_RETENTION_SECONDS
  const firstInsideWindow = samples.findIndex((item) => item.timestamp >= cutoff)
  if (firstInsideWindow === -1) return { samples: samples.slice(-1) }
  if (firstInsideWindow === 0) return { samples }
  return { samples: samples.slice(firstInsideWindow - 1) }
}

export function averageHistoricalPerformance(
  history: PerformanceHistory,
  now: number,
  windowSeconds: number,
): number | undefined {
  if (!Number.isFinite(now) || !Number.isFinite(windowSeconds) || windowSeconds <= 0) {
    return undefined
  }
  const samples = normalizeSamples(history.samples).filter(
    (sample) => sample.timestamp <= now,
  )
  if (samples.length === 0) return undefined

  const windowStart = Math.max(0, now - windowSeconds)
  let latestBeforeWindow = -1
  for (let index = 0; index < samples.length; index += 1) {
    if (samples[index].timestamp <= windowStart) latestBeforeWindow = index
  }
  const firstIndex = latestBeforeWindow >= 0
    ? latestBeforeWindow
    : samples.findIndex((sample) => sample.timestamp >= windowStart)
  if (firstIndex < 0) return undefined

  let weightedTotal = 0
  let observedSeconds = 0
  for (let index = firstIndex; index < samples.length; index += 1) {
    const sample = samples[index]
    const nextTimestamp = samples[index + 1]?.timestamp ?? now
    const start = Math.max(windowStart, sample.timestamp)
    const end = Math.min(now, nextTimestamp)
    if (end <= start) continue
    const duration = end - start
    weightedTotal += sample.rate * duration
    observedSeconds += duration
  }
  return observedSeconds > 0 ? weightedTotal / observedSeconds : undefined
}
