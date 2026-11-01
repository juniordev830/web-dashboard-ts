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

  test('calculateSummary should evaluate health status correctly', () => {
    const summary = calculateSummary(mockMetrics);
    expect(summary.totalMetrics).toBe(2);
    expect(summary.totalValue).toBe(505);
    expect(summary.healthStatus).toBe('CRITICAL');
  });

  test('calculateSummary should return a healthy empty summary for an empty list', () => {
    expect(calculateSummary([])).toEqual({
      totalMetrics: 0,
      totalValue: 0,
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
});
