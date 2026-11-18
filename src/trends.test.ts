import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { calculateMetricTrends, MetricSample } from './trends';

const at = (minute: number, value: number, metricId = 'latency'): MetricSample => ({
  metricId,
  timestamp: `2026-11-02T10:${String(minute).padStart(2, '0')}:00.000Z`,
  value,
});

describe('calculateMetricTrends', () => {
  test('orders UTC samples chronologically and reports absolute and percentage change', () => {
    const samples = [at(2, 130), at(0, 100), at(1, 115)];
    const original = [...samples];

    assert.deepEqual(calculateMetricTrends(samples), [{
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
    assert.deepEqual(samples, original); // The input order is unchanged.
  });

  test('ignores single observations and reports zero-baseline percentage as null', () => {
    const trends = calculateMetricTrends([
      at(1, 10, 'zero'), at(0, 0, 'zero'), at(0, 2, 'single'),
    ]);
    assert.equal((trends).length, 1);
    assert.equal(trends[0].metricId, 'zero');
    assert.equal(trends[0].percentageChange, null);
    assert.equal(trends[0].direction, 'up');
  });

  test('separates ids that resemble object prototype properties', () => {
    const samples = [
      at(0, 10, '__proto__'), at(1, 10, '__proto__'),
      at(0, 5, 'toString'), at(1, 2, 'toString'),
    ];
    const result = calculateMetricTrends(samples);
    assert.deepEqual(result.map(item => item.metricId).sort(), ['__proto__', 'toString'].sort());
    assert.equal(result.find(item => item.metricId === '__proto__')?.direction, 'flat');
    assert.equal(result.find(item => item.metricId === 'toString')?.absoluteChange, -3);
    assert.equal(result.find(item => item.metricId === 'toString')?.percentageChange, -60);
  });

  test('normalizes id whitespace but rejects duplicate timestamps for the same metric', () => {
    assert.throws(() => calculateMetricTrends([at(0, 1, ' a '), at(0, 2, 'a')]), /Duplicate sample timestamp/);
  });

  test('rejects invalid calendar dates and noncanonical or offset timestamps', () => {
    const invalid = [
      '2026-02-30T10:00:00.000Z',
      '2026-11-02T10:00:00Z',
      '2026-11-02T10:00:00.000+00:00',
      'not-a-date',
    ];
    for (const timestamp of invalid) {
      assert.throws(() => calculateMetricTrends([{ metricId: 'a', timestamp, value: 1 }]), RangeError);
    }
  });

  test('rejects non-array input and oversized telemetry batches', () => {
    assert.throws(() => calculateMetricTrends(null as unknown as MetricSample[]), TypeError);
    assert.throws(() => calculateMetricTrends({} as unknown as MetricSample[]), TypeError);
    const oversized = Array(100_001).fill(at(0, 1));
    assert.throws(() => calculateMetricTrends(oversized), /At most 100000 samples/);
  });

  test('rejects invalid ids and non-finite numbers', () => {
    assert.throws(() => calculateMetricTrends([at(0, 1, '  ')]), RangeError);
    for (const value of [NaN, Infinity, -Infinity]) {
      assert.throws(() => calculateMetricTrends([at(0, value)]), RangeError);
    }
  });

  test('rejects arithmetic overflow instead of emitting infinite trend values', () => {
    assert.throws(() => calculateMetricTrends([at(0, -Number.MAX_VALUE), at(1, Number.MAX_VALUE)]), /Trend change/);
    assert.throws(() => calculateMetricTrends([at(0, Number.MIN_VALUE), at(1, 1)]), /Trend percentage/);
  });
});
