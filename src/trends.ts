/**
 * Pure UTC time-series analysis for monitoring dashboards.
 * Input samples are never mutated and no network or storage is used.
 */
export interface MetricSample {
  metricId: string;
  timestamp: string; // canonical UTC, e.g. 2026-11-02T10:00:00.000Z
  value: number;
}

export interface MetricTrend {
  metricId: string;
  sampleCount: number;
  firstTimestamp: string;
  lastTimestamp: string;
  firstValue: number;
  lastValue: number;
  absoluteChange: number;
  percentageChange: number | null;
  direction: 'up' | 'down' | 'flat';
}

type TimedSample = { timestamp: string; epoch: number; value: number };
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function parseTimestamp(timestamp: string): number {
  if (typeof timestamp !== 'string' || !UTC_TIMESTAMP.test(timestamp)) {
    throw new RangeError('Sample timestamp must use canonical UTC ISO 8601 format');
  }
  const epoch = Date.parse(timestamp);
  // Date.parse may roll invalid calendar days forward; require a round-trip.
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== timestamp) {
    throw new RangeError('Invalid sample timestamp');
  }
  return epoch;
}

/**
 * Compares the earliest and latest observations for each metric with >= 2 samples.
 * A zero baseline yields percentageChange: null, never Infinity/NaN.
 * Percentage change uses the absolute value of the first observation as its base.
 */
export function calculateMetricTrends(samples: readonly MetricSample[]): MetricTrend[] {
  const groups = new Map<string, TimedSample[]>();
  const observed = new Map<string, Set<number>>();

  for (const sample of samples) {
    if (!sample || typeof sample.metricId !== 'string' || !sample.metricId.trim()) {
      throw new RangeError('Sample metricId must be a non-empty string');
    }
    if (!Number.isFinite(sample.value)) {
      throw new RangeError(`Sample value for metric "${sample.metricId}" must be finite`);
    }

    const id = sample.metricId.trim();
    const epoch = parseTimestamp(sample.timestamp);
    const used = observed.get(id) ?? new Set<number>();
    if (used.has(epoch)) {
      throw new RangeError(`Duplicate sample timestamp for metric "${id}"`);
    }
    used.add(epoch);
    observed.set(id, used);

    const group = groups.get(id) ?? [];
    group.push({ timestamp: sample.timestamp, epoch, value: sample.value });
    groups.set(id, group);
  }

  const output: MetricTrend[] = [];
  for (const [metricId, group] of groups) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => a.epoch - b.epoch);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const absoluteChange = last.value - first.value;
    if (!Number.isFinite(absoluteChange)) {
      throw new RangeError(`Trend change for metric "${metricId}" is not finite`);
    }
    const percentageChange =
      first.value === 0 ? null : (absoluteChange / Math.abs(first.value)) * 100;
    if (percentageChange !== null && !Number.isFinite(percentageChange)) {
      throw new RangeError(`Trend percentage for metric "${metricId}" is not finite`);
    }

    output.push({
      metricId,
      sampleCount: ordered.length,
      firstTimestamp: first.timestamp,
      lastTimestamp: last.timestamp,
      firstValue: first.value,
      lastValue: last.value,
      absoluteChange,
      percentageChange,
      direction: absoluteChange > 0 ? 'up' : absoluteChange < 0 ? 'down' : 'flat',
    });
  }
  return output.sort((a, b) => a.metricId.localeCompare(b.metricId));
}

/** UTC daily rollup per metric, suitable for rendering a time-series chart. */
export interface DailyMetricSummary {
  metricId: string;
  date: string; // YYYY-MM-DD (UTC)
  count: number;
  minimum: number;
  maximum: number;
  average: number;
}

/**
 * Groups valid metric samples into UTC days. Uses an incremental weighted mean
 * rather than summing raw values, avoiding unnecessary arithmetic overflow.
 * Each metric/timestamp pair must be unique.
 */
export function summarizeDailyMetrics(samples: readonly MetricSample[]): DailyMetricSummary[] {
  const groups = new Map<string, DailyMetricSummary>();
  const observed = new Map<string, Set<number>>();

  for (const sample of samples) {
    if (!sample || typeof sample.metricId !== 'string' || !sample.metricId.trim()) {
      throw new RangeError('Sample metricId must be a non-empty string');
    }
    if (!Number.isFinite(sample.value)) {
      throw new RangeError('Sample value must be finite');
    }

    const metricId = sample.metricId.trim();
    const epoch = parseTimestamp(sample.timestamp);
    const uniqueTimestamps = observed.get(metricId) ?? new Set<number>();
    if (uniqueTimestamps.has(epoch)) {
      throw new RangeError(`Duplicate sample timestamp for metric "${metricId}"`);
    }
    uniqueTimestamps.add(epoch);
    observed.set(metricId, uniqueTimestamps);

    const date = sample.timestamp.slice(0, 10);
    const key = JSON.stringify([metricId, date]);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        metricId,
        date,
        count: 1,
        minimum: sample.value,
        maximum: sample.value,
        average: sample.value,
      });
      continue;
    }

    const nextCount = existing.count + 1;
    const mean = (existing.average * existing.count / nextCount) +
                 (sample.value / nextCount);
    if (!Number.isFinite(mean)) {
      throw new RangeError('Daily metric average must remain finite');
    }
    groups.set(key, {
      metricId,
      date,
      count: nextCount,
      minimum: Math.min(existing.minimum, sample.value),
      maximum: Math.max(existing.maximum, sample.value),
      average: mean,
    });
  }

  return [...groups.values()].sort((a, b) =>
    a.date.localeCompare(b.date) || a.metricId.localeCompare(b.metricId));
}
