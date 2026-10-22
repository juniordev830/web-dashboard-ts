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
});
