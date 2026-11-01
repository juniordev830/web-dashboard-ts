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
  const totalsByUnit: Record<string, number> = {};

  for (const metric of metrics) {
    if (!Number.isFinite(metric.value)) {
      throw new RangeError(`Metric "${metric.id}" must have a finite numeric value`);
    }
    const unit = metric.unit.trim();
    if (!unit) {
      throw new RangeError(`Metric "${metric.id}" must have a non-empty unit`);
    }
    totalsByUnit[unit] = (totalsByUnit[unit] ?? 0) + metric.value;
  }

  const warningCount = metrics.filter(m => m.status === 'warning').length;
  const criticalCount = metrics.filter(m => m.status === 'critical').length;

  return {
    totalMetrics: metrics.length,
    totalsByUnit,
    healthStatus: criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'WARNING' : 'HEALTHY'
  };
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
}

if (require.main === module) {
  main();
}
