import { calculateMetricTrends, MetricSample, summarizeDailyMetrics } from './trends';

const at = (minute: number, value: number, metricId = 'latency'): MetricSample => ({
  metricId,
  timestamp: `2026-11-02T10:${String(minute).padStart(2, '0')}:00.000Z`,
  value,
});

describe('calculateMetricTrends', () => {
  test('orders UTC samples chronologically and reports absolute and percentage change', () => {
    const samples = [at(2, 130), at(0, 100), at(1, 115)];
    const original = [...samples];

    expect(calculateMetricTrends(samples)).toEqual([{
      metricId: 'latency',
      sampleCount: 3,
      firstTimestamp: '2026-11-02T10:00:00.000Z',
      lastTimestamp: '2026-11-02T10:02:00.000Z',
      firstValue: 100,
      lastValue: 130,
      absoluteChange: 30,
      percentageChange: 30,
      direction: 'up',
    }]);
    expect(samples).toEqual(original); // The input order is unchanged.
  });

  test('ignores single observations and reports zero-baseline percentage as null', () => {
    const trends = calculateMetricTrends([
      at(1, 10, 'zero'), at(0, 0, 'zero'), at(0, 2, 'single'),
    ]);
    expect(trends).toHaveLength(1);
    expect(trends[0].metricId).toBe('zero');
    expect(trends[0].percentageChange).toBeNull();
    expect(trends[0].direction).toBe('up');
  });

  test('separates ids that resemble object prototype properties', () => {
    const samples = [
      at(0, 10, '__proto__'), at(1, 10, '__proto__'),
      at(0, 5, 'toString'), at(1, 2, 'toString'),
    ];
    const result = calculateMetricTrends(samples);
    expect(result.map(item => item.metricId).sort()).toEqual(['__proto__', 'toString'].sort());
    expect(result.find(item => item.metricId === '__proto__')?.direction).toBe('flat');
    expect(result.find(item => item.metricId === 'toString')?.absoluteChange).toBe(-3);
    expect(result.find(item => item.metricId === 'toString')?.percentageChange).toBe(-60);
  });

  test('normalizes id whitespace but rejects duplicate timestamps for the same metric', () => {
    expect(() => calculateMetricTrends([at(0, 1, ' a '), at(0, 2, 'a')]))
      .toThrow('Duplicate sample timestamp');
  });

  test('rejects invalid calendar dates and noncanonical or offset timestamps', () => {
    const invalid = [
      '2026-02-30T10:00:00.000Z',
      '2026-11-02T10:00:00Z',
      '2026-11-02T10:00:00.000+00:00',
      'not-a-date',
    ];
    for (const timestamp of invalid) {
      expect(() => calculateMetricTrends([{ metricId: 'a', timestamp, value: 1 }]))
        .toThrow(RangeError);
    }
  });

  test('rejects invalid ids and non-finite numbers', () => {
    expect(() => calculateMetricTrends([at(0, 1, '  ')])).toThrow(RangeError);
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => calculateMetricTrends([at(0, value)])).toThrow(RangeError);
    }
  });

  test('rejects arithmetic overflow instead of emitting infinite trend values', () => {
    expect(() => calculateMetricTrends([at(0, -Number.MAX_VALUE), at(1, Number.MAX_VALUE)]))
      .toThrow('Trend change');
    expect(() => calculateMetricTrends([at(0, Number.MIN_VALUE), at(1, 1)]))
      .toThrow('Trend percentage');
  });
});

describe('summarizeDailyMetrics', () => {
  test('aggregates by UTC day and metric, sorting days then metric IDs', () => {
    const samples: MetricSample[] = [
      { metricId: 'latency', timestamp: '2026-11-03T10:00:00.000Z', value: 40 },
      { metricId: 'users', timestamp: '2026-11-02T10:00:00.000Z', value: 3 },
      { metricId: 'latency', timestamp: '2026-11-02T09:00:00.000Z', value: 20 },
      { metricId: 'latency', timestamp: '2026-11-02T08:00:00.000Z', value: 10 },
      { metricId: 'latency', timestamp: '2026-11-02T10:00:00.000Z', value: 30 },
    ];
    const copy = [...samples];

    expect(summarizeDailyMetrics(samples)).toEqual([
      { metricId: 'latency', date: '2026-11-02', count: 3,
        minimum: 10, maximum: 30, average: 20 },
      { metricId: 'users', date: '2026-11-02', count: 1,
        minimum: 3, maximum: 3, average: 3 },
      { metricId: 'latency', date: '2026-11-03', count: 1,
        minimum: 40, maximum: 40, average: 40 },
    ]);
    expect(samples).toEqual(copy);
  });

  test('handles large values without summing to Infinity', () => {
    const result = summarizeDailyMetrics([
      at(0, Number.MAX_VALUE),
      at(1, Number.MAX_VALUE),
    ]);
    expect(result).toHaveLength(1);
    expect(Number.isFinite(result[0].average)).toBe(true);
    expect(result[0].minimum).toBe(Number.MAX_VALUE);
    expect(result[0].maximum).toBe(Number.MAX_VALUE);
  });

  test('handles daily boundaries and special metric names without collisions', () => {
    const results = summarizeDailyMetrics([
      { metricId: '__proto__', timestamp: '2026-11-02T23:59:59.999Z', value: 2 },
      { metricId: '__proto__', timestamp: '2026-11-03T00:00:00.000Z', value: 4 },
      { metricId: 'toString', timestamp: '2026-11-03T00:00:00.000Z', value: 8 },
    ]);
    expect(results).toHaveLength(3);
    expect(results.map(item => item.date)).toEqual(['2026-11-02','2026-11-03','2026-11-03']);
  });

  test('rejects duplicate samples, malformed timestamps and nonfinite values', () => {
    expect(() => summarizeDailyMetrics([at(0, 10, ' lat '), at(0, 20, 'lat')]))
      .toThrow('Duplicate sample timestamp');
    expect(() => summarizeDailyMetrics([
      { metricId: 'x', timestamp: '2026-02-30T10:00:00.000Z', value: 1 },
    ])).toThrow(RangeError);
    expect(() => summarizeDailyMetrics([at(0, Number.NaN)])).toThrow(RangeError);
    expect(() => summarizeDailyMetrics([at(0, 1, '  ')])).toThrow(RangeError);
    expect(summarizeDailyMetrics([])).toEqual([]);
  });
});
