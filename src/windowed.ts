import { MetricSample, parseTimestamp } from './trends';

export interface MetricWindow {
  metricId: string;
  start: string;
  windowMinutes: number;
  samples: number;
  min: number;
  max: number;
  mean: number;
}

/**
 * Aggregate timestamped metrics into UTC-aligned buckets of 1-1440 minutes.
 * No I/O, mutation, locale-dependent dates, or unbounded accumulation.
 */
export function bucketMetricSamples(
  samples: readonly MetricSample[], windowMinutes = 60
): MetricWindow[] {
  if (!Array.isArray(samples)) throw new TypeError('Samples must be an array');
  if (samples.length > 100_000) throw new RangeError('At most 100000 samples');
  if (!Number.isSafeInteger(windowMinutes) || windowMinutes < 1 || windowMinutes > 1440) {
    throw new RangeError('windowMinutes must be an integer between 1 and 1440');
  }
  const width = windowMinutes * 60_000;
  const groups = new Map<string, Map<number, {
    samples: number; min: number; max: number; mean: number;
  }>>();
  const seen = new Map<string, Set<number>>();

  for (const sample of samples) {
    if (!sample || typeof sample.metricId !== 'string' || !sample.metricId.trim()) {
      throw new RangeError('Sample metricId must be non-empty');
    }
    if (typeof sample.value !== 'number' || !Number.isFinite(sample.value)) {
      throw new RangeError('Sample value must be a finite number');
    }
    const metricId = sample.metricId.trim();
    const time = parseTimestamp(sample.timestamp);
    const used = seen.get(metricId) ?? new Set<number>();
    if (used.has(time)) throw new RangeError('Duplicate timestamp for metric ' + metricId);
    used.add(time);
    seen.set(metricId, used);

    const start = Math.floor(time / width) * width;
    const metricGroups = groups.get(metricId) ?? new Map();
    const group = metricGroups.get(start);
    if (!group) {
      metricGroups.set(start, {
        samples: 1, min: sample.value, max: sample.value, mean: sample.value,
      });
    } else {
      const count = group.samples + 1;
      group.mean = group.mean * (group.samples / count) + sample.value / count;
      group.samples = count;
      group.min = Math.min(group.min, sample.value);
      group.max = Math.max(group.max, sample.value);
    }
    groups.set(metricId, metricGroups);
  }

  const result: MetricWindow[] = [];
  for (const [metricId, metricGroups] of groups) {
    for (const [start, summary] of metricGroups) {
      result.push({
        metricId,
        start: new Date(start).toISOString(),
        windowMinutes,
        ...summary,
      });
    }
  }
  return result.sort((a, b) =>
    a.metricId.localeCompare(b.metricId) || a.start.localeCompare(b.start));
}
