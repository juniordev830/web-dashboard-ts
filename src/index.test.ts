import { DashboardMetric, formatMetric, calculateSummary } from './index';

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

  test('calculateSummary should combine metrics that share a unit', () => {
    const metrics: DashboardMetric[] = [
      { id: '1', title: 'Revenue A', value: 100, unit: 'USD', status: 'optimal' },
      { id: '2', title: 'Revenue B', value: 250, unit: 'USD', status: 'warning' }
    ];
    expect(calculateSummary(metrics).totalsByUnit).toEqual({ USD: 350 });
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
});
