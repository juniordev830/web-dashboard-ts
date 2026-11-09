import { summarizeMetricDistributions, type MetricObservation } from './statistics';

describe('summarizeMetricDistributions', () => {
  test('calculates mean, median and interpolated p95 for unsorted observations', () => {
    expect(summarizeMetricDistributions([
      { metricId: 'latency', value: 40 },
      { metricId: 'latency', value: 10 },
      { metricId: 'latency', value: 50 },
      { metricId: 'latency', value: 30 },
      { metricId: 'latency', value: 20 }
    ])).toEqual([{
      metricId: 'latency',
      sampleCount: 5,
      min: 10,
      max: 50,
      mean: 30,
      median: 30,
      p95: 48
    }]);
  });

  test('works with empty arrays, a single value and two values', () => {
    expect(summarizeMetricDistributions([])).toEqual([]);
    expect(summarizeMetricDistributions([{ metricId: 'a', value: 7 }])).toEqual([{
      metricId: 'a', sampleCount: 1, min: 7, max: 7, mean: 7, median: 7, p95: 7
    }]);
    const pair = summarizeMetricDistributions([
      { metricId: 'a', value: 0 }, { metricId: 'a', value: 100 }
    ])[0];
    expect(pair.median).toBe(50);
    expect(pair.p95).toBeCloseTo(95);
  });

  test('normalizes identifiers and keeps special object-like IDs separated', () => {
    const result = summarizeMetricDistributions([
      { metricId: ' __proto__ ', value: 3 },
      { metricId: 'constructor', value: 8 },
      { metricId: '__proto__', value: 5 }
    ]);
    expect(result.map(item => item.metricId).sort()).toEqual(['__proto__', 'constructor'].sort());
    expect(result.find(item => item.metricId === '__proto__')?.mean).toBe(4);
  });

  test('does not mutate frozen arrays and their observations', () => {
    const observations: readonly MetricObservation[] = Object.freeze([
      Object.freeze({ metricId: 'a', value: 10 }),
      Object.freeze({ metricId: 'a', value: 5 })
    ]);
    expect(summarizeMetricDistributions(observations)[0].median).toBe(7.5);
    expect(observations[0].value).toBe(10);
  });

  test('rejects invalid arrays, IDs and non-finite values', () => {
    expect(() => summarizeMetricDistributions(null as unknown as MetricObservation[]))
      .toThrow(TypeError);
    expect(() => summarizeMetricDistributions([{ metricId: '  ', value: 1 }]))
      .toThrow(RangeError);
    for (const value of [NaN, Infinity, -Infinity, '1' as unknown as number]) {
      expect(() => summarizeMetricDistributions([{ metricId: 'a', value }]))
        .toThrow(RangeError);
    }
  });

  test('handles extreme positive and negative values without sum overflow', () => {
    const result = summarizeMetricDistributions([
      { metricId: 'huge', value: -Number.MAX_VALUE },
      { metricId: 'huge', value: Number.MAX_VALUE }
    ])[0];
    expect(result.mean).toBe(0);
    expect(result.median).toBe(0);
    expect(Number.isFinite(result.p95)).toBe(true);
    expect(result.min).toBe(-Number.MAX_VALUE);
    expect(result.max).toBe(Number.MAX_VALUE);
  });
});
