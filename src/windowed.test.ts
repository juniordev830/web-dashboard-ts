import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { bucketMetricSamples } from './windowed';
import type { MetricSample } from './trends';

const at = (minute: string, value: number, metricId = 'latency'): MetricSample => ({
  metricId, value, timestamp: `2026-11-09T10:${minute}:00.000Z`,
});

describe('bucketMetricSamples', () => {
  test('groups UTC minutes by metric and sorts independent of input order', () => {
    const input = [
      at('39', 40), at('03', 10), at('20', 30), at('06', 7, 'cpu'),
      at('59', 100), at('01', 2, 'cpu'),
    ];
    const result = bucketMetricSamples(input, 30);
    assert.deepEqual(result, [
      { metricId: 'cpu', start: '2026-11-09T10:00:00.000Z',
        windowMinutes: 30, samples: 2, min: 2, max: 7, mean: 4.5 },
      { metricId: 'latency', start: '2026-11-09T10:00:00.000Z',
        windowMinutes: 30, samples: 2, min: 10, max: 30, mean: 20 },
      { metricId: 'latency', start: '2026-11-09T10:30:00.000Z',
        windowMinutes: 30, samples: 2, min: 40, max: 100, mean: 70 },
    ]);
  });

  test('resets non-divisor windows at UTC midnight', () => {
    const input: MetricSample[] = [
      { metricId: 'latency', timestamp: '2026-11-10T00:01:00.000Z', value: 20 },
      { metricId: 'latency', timestamp: '2026-11-09T23:59:00.000Z', value: 10 },
      { metricId: 'latency', timestamp: '2026-11-10T00:06:00.000Z', value: 30 },
      { metricId: 'latency', timestamp: '2026-11-10T00:07:00.000Z', value: 50 },
    ];
    assert.deepEqual(bucketMetricSamples(input, 7), [
      { metricId: 'latency', start: '2026-11-09T23:55:00.000Z',
        windowMinutes: 7, samples: 1, min: 10, max: 10, mean: 10 },
      { metricId: 'latency', start: '2026-11-10T00:00:00.000Z',
        windowMinutes: 7, samples: 2, min: 20, max: 30, mean: 25 },
      { metricId: 'latency', start: '2026-11-10T00:07:00.000Z',
        windowMinutes: 7, samples: 1, min: 50, max: 50, mean: 50 },
    ]);
  });

  test('keeps 24-hour windows anchored to midnight UTC', () => {
    const input: MetricSample[] = [
      { metricId: 'latency', timestamp: '2026-11-09T23:59:00.000Z', value: 10 },
      { metricId: 'latency', timestamp: '2026-11-10T00:00:00.000Z', value: 20 },
    ];
    const result = bucketMetricSamples(input, 1440);
    assert.deepEqual(result.map(window => window.start), [
      '2026-11-09T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    ]);
  });

  test('handles UTC year rollover without joining samples into one bucket', () => {
    const samples: MetricSample[] = [
      { metricId: 'cpu', timestamp: '2026-12-31T23:59:00.000Z', value: 10 },
      { metricId: 'cpu', timestamp: '2027-01-01T00:00:00.000Z', value: 20 },
      { metricId: 'cpu', timestamp: '2027-01-01T00:06:00.000Z', value: 30 },
    ];
    const result = bucketMetricSamples(samples, 7);
    assert.deepEqual(result.map((bucket) => [bucket.start, bucket.samples]), [
      ['2026-12-31T23:55:00.000Z', 1],
      ['2027-01-01T00:00:00.000Z', 2],
    ]);
  });

  test('returns empty list and keeps frozen input intact', () => {
    assert.deepEqual(bucketMetricSamples([]), []);
    const data = Object.freeze([Object.freeze(at('00', 12))]);
    assert.equal(bucketMetricSamples(data)[0].samples, 1);
    assert.equal(data[0].value, 12);
  });

  test('guards invalid windows, samples, duplicate timestamps and timestamps', () => {
    for (const invalid of [0, -1, 1.5, Infinity, 1441]) {
      assert.throws(() => bucketMetricSamples([], invalid), RangeError);
    }
    assert.throws(() => bucketMetricSamples(null as unknown as MetricSample[]), TypeError);
    assert.throws(() => bucketMetricSamples([at('00', 1), at('00', 2)]), /Duplicate/);
    assert.throws(() => bucketMetricSamples([at('99', 3)]), RangeError);
    assert.throws(() => bucketMetricSamples([at('00', Infinity)]), RangeError);
    assert.throws(() => bucketMetricSamples([{ ...at('00', 1), metricId: ' ' }]), RangeError);
  });

  test('keeps sums finite with extreme signed observations', () => {
    const result = bucketMetricSamples([
      at('01', -Number.MAX_VALUE), at('02', Number.MAX_VALUE),
    ]);
    assert.equal(result[0].mean, 0);
    assert.equal(Number.isFinite(result[0].mean), true);
  });

  test('does not round identical subnormal samples down to zero', () => {
    const [result] = bucketMetricSamples([
      at('01', Number.MIN_VALUE), at('02', Number.MIN_VALUE),
    ]);
    assert.equal(result.mean, Number.MIN_VALUE);
  });
});
