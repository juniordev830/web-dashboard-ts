/**
 * Dependency-free descriptive statistics for dashboard metrics.
 *
 * Observations can come from any source; this function does not fetch,
 * persist or mutate the caller's data.
 */
export interface MetricObservation {
  metricId: string;
  value: number;
}

export interface MetricDistribution {
  metricId: string;
  sampleCount: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
}

/**
 * Interpolated quantile using the (n - 1) * percentile index.
 * Weighted interpolation avoids intermediate overflow for extreme values.
 */
function quantile(sorted: readonly number[], percentile: number): number {
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const fraction = position - lower;
  return sorted[lower] * (1 - fraction) + sorted[upper] * fraction;
}

/** Groups observations by trimmed metricId, with stable finite statistics. */
export function summarizeMetricDistributions(
  observations: readonly MetricObservation[]
): MetricDistribution[] {
  if (!Array.isArray(observations)) {
    throw new TypeError('Observations must be an array');
  }

  const groups = new Map<string, number[]>();
  for (const observation of observations) {
    if (!observation || typeof observation.metricId !== 'string' ||
        !observation.metricId.trim()) {
      throw new RangeError('Observation metricId must be non-empty');
    }
    if (typeof observation.value !== 'number' || !Number.isFinite(observation.value)) {
      throw new RangeError('Observation value must be a finite number');
    }
    const id = observation.metricId.trim();
    const values = groups.get(id) ?? [];
    values.push(observation.value);
    groups.set(id, values);
  }

  const distributions: MetricDistribution[] = [];
  for (const [metricId, values] of groups) {
    const sorted = [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);

    // Online weighted mean avoids overflowing an intermediate sum.
    let mean = 0;
    for (let index = 0; index < values.length; index += 1) {
      const count = index + 1;
      mean = mean * ((count - 1) / count) + values[index] / count;
    }

    distributions.push({
      metricId,
      sampleCount: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: quantile(sorted, 0.5),
      p95: quantile(sorted, 0.95)
    });
  }

  return distributions.sort((a, b) => a.metricId.localeCompare(b.metricId));
}
