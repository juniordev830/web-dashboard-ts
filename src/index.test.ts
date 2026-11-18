import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DashboardMetric, formatMetric, calculateSummary, calculateHealthScore } from './index';

describe('Web Dashboard Metrics Utilities', () => {
  const mockMetrics: DashboardMetric[] = [
    { id: '1', title: 'Total Sales', value: 500, unit: 'USD', status: 'optimal' },
    { id: '2', title: 'Server Error Rate', value: 5, unit: '%', status: 'critical' }
  ];

  test('formatMetric should format metric string correctly', () => {
    const result = formatMetric(mockMetrics[0]);
    assert.equal(result, '[OPTIMAL] Total Sales: 500 USD');
  });

  test('calculateSummary should aggregate values separately by unit', () => {
    const summary = calculateSummary(mockMetrics);
    assert.equal(summary.totalMetrics, 2);
    assert.deepEqual(summary.totalsByUnit, { USD: 500, '%': 5 });
    assert.equal(summary.healthStatus, 'CRITICAL');
  });

  test('calculateHealthScore penalizes warnings and critical metrics', () => {
    assert.equal(calculateHealthScore([]), 100);
    assert.equal(calculateHealthScore([
      { id: '1', title: 'Healthy', value: 1, unit: 'u', status: 'optimal' },
      { id: '2', title: 'Warning', value: 1, unit: 'u', status: 'warning' },
      { id: '3', title: 'Critical', value: 1, unit: 'u', status: 'critical' },
    ]), 78);
  });

  test('calculateSummary should combine metrics that share a unit', () => {
    const metrics: DashboardMetric[] = [
      { id: '1', title: 'Revenue A', value: 100, unit: 'USD', status: 'optimal' },
      { id: '2', title: 'Revenue B', value: 250, unit: 'USD', status: 'warning' }
    ];
    assert.deepEqual(calculateSummary(metrics).totalsByUnit, { USD: 350 });
  });

  test('calculateSummary safely aggregates units named like Object prototype keys', () => {
    const units = ['toString', 'constructor', '__proto__', 'hasOwnProperty'];
    const metrics: DashboardMetric[] = units.flatMap((unit, index) => [
      { id: `special-${index}-a`, title: 'Metric A', value: 2, unit, status: 'optimal' },
      { id: `special-${index}-b`, title: 'Metric B', value: 3, unit, status: 'warning' },
    ]);

    const result = calculateSummary(metrics);
    assert.equal(result.totalMetrics, 8);
    assert.equal(result.healthStatus, 'WARNING');
    assert.deepEqual(Object.keys(result.totalsByUnit).sort(), [...units].sort());
    for (const unit of units) {
      assert.equal(Object.prototype.hasOwnProperty.call(result.totalsByUnit, unit), true);
      assert.equal(result.totalsByUnit[unit], 5);
    }
    assert.equal(Object.getPrototypeOf(result.totalsByUnit), Object.prototype);
  });

  test('calculateSummary should return a healthy empty summary for an empty list', () => {
    assert.deepEqual(calculateSummary([]), {
      totalMetrics: 0,
      totalsByUnit: {},
      healthStatus: 'HEALTHY'
    });
  });

  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    test(`calculateSummary should reject non-finite values (${value})`, () => {
      const invalidMetric: DashboardMetric = {
        id: 'invalid',
        title: 'Invalid metric',
        value,
        unit: 'units',
        status: 'optimal'
      };
      assert.throws(() => calculateSummary([invalidMetric]), RangeError);
    });
  }

  test('calculateSummary should reject missing or whitespace-only units', () => {
    const invalidMetric: DashboardMetric = {
      id: 'invalid',
      title: 'Invalid metric',
      value: 1,
      unit: '   ',
      status: 'optimal'
    };
    assert.throws(() => calculateSummary([invalidMetric]), RangeError);
  });

  test('calculateSummary should reject overflow while aggregating a shared unit', () => {
    const metrics: DashboardMetric[] = [
      { id: 'large-a', title: 'Large A', value: Number.MAX_VALUE, unit: 'units', status: 'optimal' },
      { id: 'large-b', title: 'Large B', value: Number.MAX_VALUE, unit: 'units', status: 'optimal' }
    ];
    assert.throws(() => calculateSummary(metrics), RangeError);
    assert.throws(() => calculateSummary(metrics), /Aggregated total for unit "units" must remain finite/);
  });

  test('calculateSummary rejects invalid runtime metric rows and missing units', () => {
    const base = {
      id: 'metric-a', title: 'Example', value: 10, unit: 'ms', status: 'optimal'
    } as const;
    const invalidRows: unknown[] = [
      null,
      { ...base, id: ' ' },
      { ...base, id: null },
      { ...base, unit: undefined },
      { ...base, unit: null },
      { ...base, unit: 42 },
      { ...base, value: '10' }
    ];
    for (const row of invalidRows) {
      assert.throws(() => calculateSummary([row as DashboardMetric]), RangeError);
      assert.throws(() => calculateHealthScore([row as DashboardMetric]), RangeError);
    }
  });

  test('calculateSummary rejects non-array metric collections', () => {
    assert.throws(() => calculateSummary(null as unknown as DashboardMetric[]), TypeError);
    assert.throws(() => calculateHealthScore({} as unknown as DashboardMetric[]), TypeError);
  });

  test('calculateSummary should reject unsupported runtime statuses', () => {
    const invalidMetric = {
      id: 'invalid-status',
      title: 'Invalid status',
      value: 10,
      unit: 'units',
      status: 'unknown'
    } as unknown as DashboardMetric;

    assert.throws(() => calculateSummary([invalidMetric]), RangeError);
    assert.throws(() => calculateSummary([invalidMetric]), /Metric "invalid-status" has an unsupported status/);
  });

});
