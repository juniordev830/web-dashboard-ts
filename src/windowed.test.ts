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
    expect(result).toEqual([
      { metricId: 'cpu', start: '2026-11-09T10:00:00.000Z',
        windowMinutes: 30, samples: 2, min: 2, max: 7, mean: 4.5 },
      { metricId: 'latency', start: '2026-11-09T10:00:00.000Z',
        windowMinutes: 30, samples: 2, min: 10, max: 30, mean: 20 },
      { metricId: 'latency', start: '2026-11-09T10:30:00.000Z',
        windowMinutes: 30, samples: 2, min: 40, max: 100, mean: 70 },
    ]);
  });

  test('returns empty list and keeps frozen input intact', () => {
    expect(bucketMetricSamples([])).toEqual([]);
    const data = Object.freeze([Object.freeze(at('00', 12))]);
    expect(bucketMetricSamples(data)[0].samples).toBe(1);
    expect(data[0].value).toBe(12);
  });

  test('guards invalid windows, samples, duplicate timestamps and timestamps', () => {
    for (const invalid of [0, -1, 1.5, Infinity, 1441]) {
      expect(() => bucketMetricSamples([], invalid)).toThrow(RangeError);
    }
    expect(() => bucketMetricSamples(null as unknown as MetricSample[])).toThrow(TypeError);
    expect(() => bucketMetricSamples([at('00', 1), at('00', 2)])).toThrow(/Duplicate/);
    expect(() => bucketMetricSamples([at('99', 3)])).toThrow(RangeError);
    expect(() => bucketMetricSamples([at('00', Infinity)])).toThrow(RangeError);
    expect(() => bucketMetricSamples([{ ...at('00', 1), metricId: ' ' }])).toThrow(RangeError);
  });

  test('keeps sums finite with extreme signed observations', () => {
    const result = bucketMetricSamples([
      at('01', -Number.MAX_VALUE), at('02', Number.MAX_VALUE),
    ]);
    expect(result[0].mean).toBe(0);
    expect(Number.isFinite(result[0].mean)).toBe(true);
  });
});
