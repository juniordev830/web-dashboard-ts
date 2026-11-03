import { DashboardMetric, formatMetric, calculateSummary, calculateHealthScore } from './index';

describe('Web Dashboard Metrics Utilities', () => {
  const mockMetrics: DashboardMetric[] = [
    { id: '1', title: 'Total Sales', value: 500, unit: 'USD', status: 'optimal' },
    { id: '2', title: 'Server Error Rate', value: 5, unit: '%', status: 'critical' }
  ];

  test('formatMetric should format metric string correctly', () => {
    const result = formatMetric(mockMetrics[0]);
    expect(result).toBe('[OPTIMAL] Total Sales: 500 USD');
  });

  test('calculateSummary should aggregate values separately by unit', () => {
    const summary = calculateSummary(mockMetrics);
    expect(summary.totalMetrics).toBe(2);
    expect(summary.totalsByUnit).toEqual({ USD: 500, '%': 5 });
    expect(summary.healthStatus).toBe('CRITICAL');
  });

  test('calculateHealthScore penalizes warnings and critical metrics', () => {
    expect(calculateHealthScore([])).toBe(100);
    expect(calculateHealthScore([
      { id: '1', title: 'Healthy', value: 1, unit: 'u', status: 'optimal' },
      { id: '2', title: 'Warning', value: 1, unit: 'u', status: 'warning' },
      { id: '3', title: 'Critical', value: 1, unit: 'u', status: 'critical' },
    ])).toBe(78);
  });

  test('calculateSummary should combine metrics that share a unit', () => {
    const metrics: DashboardMetric[] = [
      { id: '1', title: 'Revenue A', value: 100, unit: 'USD', status: 'optimal' },
      { id: '2', title: 'Revenue B', value: 250, unit: 'USD', status: 'warning' }
    ];
    expect(calculateSummary(metrics).totalsByUnit).toEqual({ USD: 350 });
  });

  test('calculateSummary safely aggregates units named like Object prototype keys', () => {
    const units = ['toString', 'constructor', '__proto__', 'hasOwnProperty'];
    const metrics: DashboardMetric[] = units.flatMap((unit, index) => [
      { id: `special-${index}-a`, title: 'Metric A', value: 2, unit, status: 'optimal' },
      { id: `special-${index}-b`, title: 'Metric B', value: 3, unit, status: 'warning' },
    ]);

    const result = calculateSummary(metrics);
    expect(result.totalMetrics).toBe(8);
    expect(result.healthStatus).toBe('WARNING');
    expect(Object.keys(result.totalsByUnit).sort()).toEqual([...units].sort());
    for (const unit of units) {
      expect(Object.prototype.hasOwnProperty.call(result.totalsByUnit, unit)).toBe(true);
      expect(result.totalsByUnit[unit]).toBe(5);
    }
    expect(Object.getPrototypeOf(result.totalsByUnit)).toBe(Object.prototype);
  });

  test('calculateSummary should return a healthy empty summary for an empty list', () => {
    expect(calculateSummary([])).toEqual({
      totalMetrics: 0,
      totalsByUnit: {},
      healthStatus: 'HEALTHY'
    });
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'calculateSummary should reject non-finite values (%s)',
    (value) => {
      const invalidMetric: DashboardMetric = {
        id: 'invalid',
        title: 'Invalid metric',
        value,
        unit: 'units',
        status: 'optimal'
      };
      expect(() => calculateSummary([invalidMetric])).toThrow(RangeError);
    }
  );

  test('calculateSummary should reject missing or whitespace-only units', () => {
    const invalidMetric: DashboardMetric = {
      id: 'invalid',
      title: 'Invalid metric',
      value: 1,
      unit: '   ',
      status: 'optimal'
    };
    expect(() => calculateSummary([invalidMetric])).toThrow(RangeError);
  });

  test('calculateSummary should reject overflow while aggregating a shared unit', () => {
    const metrics: DashboardMetric[] = [
      { id: 'large-a', title: 'Large A', value: Number.MAX_VALUE, unit: 'units', status: 'optimal' },
      { id: 'large-b', title: 'Large B', value: Number.MAX_VALUE, unit: 'units', status: 'optimal' }
    ];
    expect(() => calculateSummary(metrics)).toThrow(RangeError);
    expect(() => calculateSummary(metrics)).toThrow('Aggregated total for unit "units" must remain finite');
  });

  test('calculateSummary should reject unsupported runtime statuses', () => {
    const invalidMetric = {
      id: 'invalid-status',
      title: 'Invalid status',
      value: 10,
      unit: 'units',
      status: 'unknown'
    } as unknown as DashboardMetric;

    expect(() => calculateSummary([invalidMetric])).toThrow(RangeError);
    expect(() => calculateSummary([invalidMetric])).toThrow(
      'Metric "invalid-status" has an unsupported status'
    );
  });

});