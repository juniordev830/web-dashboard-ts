export { summarizeMetricDistributions } from './statistics';
export type { MetricDistribution, MetricObservation } from './statistics';

import { evaluateMetricAlerts } from './alerts';

export interface DashboardMetric {
  id: string;
  title: string;
  value: number;
  unit: string;
  status: 'optimal' | 'warning' | 'critical';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

export function formatMetric(metric: DashboardMetric): string {
  return `[${metric.status.toUpperCase()}] ${metric.title}: ${metric.value.toLocaleString()} ${metric.unit}`;
}

export function calculateSummary(metrics: DashboardMetric[]) {
  // Map avoids collisions with inherited Object keys such as toString and __proto__.
  const totalsByUnit = new Map<string, number>();

  for (const metric of metrics) {
    if (!Number.isFinite(metric.value)) {
      throw new RangeError(`Metric "${metric.id}" must have a finite numeric value`);
    }
    const unit = metric.unit.trim();
    if (!unit) {
      throw new RangeError(`Metric "${metric.id}" must have a non-empty unit`);
    }
    const total = (totalsByUnit.get(unit) ?? 0) + metric.value;
    if (!Number.isFinite(total)) {
      throw new RangeError(`Aggregated total for unit "${unit}" must remain finite`);
    }
    totalsByUnit.set(unit, total);
  }

  const validStatuses = new Set<DashboardMetric['status']>(['optimal', 'warning', 'critical']);
  for (const metric of metrics) {
    if (!validStatuses.has(metric.status)) {
      throw new RangeError(`Metric \"${metric.id}\" has an unsupported status`);
    }
  }

  const warningCount = metrics.filter(m => m.status === 'warning').length;
  const criticalCount = metrics.filter(m => m.status === 'critical').length;

  return {
    totalMetrics: metrics.length,
    totalsByUnit: Object.fromEntries(totalsByUnit),
    healthStatus: criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'WARNING' : 'HEALTHY'
  };
}

export function calculateHealthScore(metrics: DashboardMetric[]): number {
  // Validate the same runtime constraints as the summary before scoring.
  calculateSummary(metrics);
  if (metrics.length === 0) return 100;

  const warningCount = metrics.filter(metric => metric.status === 'warning').length;
  const criticalCount = metrics.filter(metric => metric.status === 'critical').length;
  const penalty = warningCount * 15 + criticalCount * 50;
  return Math.max(0, Math.round(100 - (penalty / metrics.length)));
}

export function main(): void {
  const metrics: DashboardMetric[] = [
    { id: '1', title: 'Active Users', value: 1250, unit: 'users', status: 'optimal' },
    { id: '2', title: 'Revenue', value: 45200, unit: 'USD', status: 'optimal' },
    { id: '3', title: 'API Latency', value: 340, unit: 'ms', status: 'warning' }
  ];

  console.log('=== Web Dashboard Metrics ===');
  metrics.forEach(m => console.log(formatMetric(m)));
  console.log('Summary:', calculateSummary(metrics));
  const alerts = evaluateMetricAlerts(metrics, [
    { metricId: '3', direction: 'above', warning: 300, critical: 500 },
    { metricId: '1', direction: 'below', warning: 100, critical: 20 },
  ]);
  console.log('Threshold alerts:', alerts);

}

if (require.main === module) {
  main();
}
