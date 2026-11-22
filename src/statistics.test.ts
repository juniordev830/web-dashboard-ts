import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { summarizeMetricDistributions, type MetricObservation } from './statistics';

describe('summarizeMetricDistributions', () => {
  test('calculates mean, median and interpolated p95 for unsorted observations', () => {
    assert.deepEqual(summarizeMetricDistributions([
      { metricId: 'latency', value: 40 },
      { metricId: 'latency', value: 10 },
      { metricId: 'latency', value: 50 },
      { metricId: 'latency', value: 30 },
      { metricId: 'latency', value: 20 }
    ]), [{
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
    assert.deepEqual(summarizeMetricDistributions([]), []);
    assert.deepEqual(summarizeMetricDistributions([{ metricId: 'a', value: 7 }]), [{
      metricId: 'a', sampleCount: 1, min: 7, max: 7, mean: 7, median: 7, p95: 7
    }]);
    const pair = summarizeMetricDistributions([
      { metricId: 'a', value: 0 }, { metricId: 'a', value: 100 }
    ])[0];
    assert.equal(pair.median, 50);
    assert.ok(Math.abs(pair.p95 - 95) < 0.005);
  });

  test('normalizes identifiers and keeps special object-like IDs separated', () => {
    const result = summarizeMetricDistributions([
      { metricId: ' __proto__ ', value: 3 },
      { metricId: 'constructor', value: 8 },
      { metricId: '__proto__', value: 5 }
    ]);
    assert.deepEqual(result.map(item => item.metricId).sort(), ['__proto__', 'constructor'].sort());
    assert.equal(result.find(item => item.metricId === '__proto__')?.mean, 4);
  });

  test('does not mutate frozen arrays and their observations', () => {
    const observations: readonly MetricObservation[] = Object.freeze([
      Object.freeze({ metricId: 'a', value: 10 }),
      Object.freeze({ metricId: 'a', value: 5 })
    ]);
    assert.equal(summarizeMetricDistributions(observations)[0].median, 7.5);
    assert.equal(observations[0].value, 10);
  });

  test('rejects invalid arrays, IDs and non-finite values', () => {
    assert.throws(() => summarizeMetricDistributions(null as unknown as MetricObservation[]), TypeError);
    assert.throws(() => summarizeMetricDistributions([{ metricId: '  ', value: 1 }]), RangeError);
    for (const value of [NaN, Infinity, -Infinity, '1' as unknown as number]) {
      assert.throws(() => summarizeMetricDistributions([{ metricId: 'a', value }]), RangeError);
    }
  });

  test('handles extreme positive and negative values without sum overflow', () => {
    const result = summarizeMetricDistributions([
      { metricId: 'huge', value: -Number.MAX_VALUE },
      { metricId: 'huge', value: Number.MAX_VALUE }
    ])[0];
    assert.equal(result.mean, 0);
    assert.equal(result.median, 0);
    assert.equal(Number.isFinite(result.p95), true);
    assert.equal(result.min, -Number.MAX_VALUE);
    assert.equal(result.max, Number.MAX_VALUE);
  });

  test('preserves identical subnormal inputs in mean and quantiles', () => {
    const result = summarizeMetricDistributions([
      { metricId: 'tiny', value: Number.MIN_VALUE },
      { metricId: 'tiny', value: Number.MIN_VALUE },
    ])[0];
    assert.equal(result.mean, Number.MIN_VALUE);
    assert.equal(result.median, Number.MIN_VALUE);
    assert.equal(result.p95, Number.MIN_VALUE);
  });
});


test('rejects oversized batches before grouping observations', () => {
  const one = { metricId: 'latency', value: 1 };
  assert.throws(() => summarizeMetricDistributions(Array(100001).fill(one)), RangeError);
  assert.equal(summarizeMetricDistributions([one]).length, 1);
});


test('rejects oversized and control-character metric identifiers', () => {
  for (const metricId of ['a'.repeat(121), 'metric\nother', 'metric\u202e']) {
    assert.throws(() => summarizeMetricDistributions([{ metricId, value: 1 }]), RangeError);
  }
  assert.equal(summarizeMetricDistributions([{ metricId: 'cpu', value: 1 }])[0].metricId, 'cpu');
});
