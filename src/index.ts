export interface DashboardMetric {
  id: string;
  title: string;
  value: number;
  unit: string;
}

export function formatMetric(metric: DashboardMetric): string {
  return `${metric.title}: ${metric.value} ${metric.unit}`;
}

export function main(): void {
  const metrics: DashboardMetric[] = [
    { id: '1', title: 'Active Users', value: 1250, unit: 'users' },
    { id: '2', title: 'Revenue', value: 45200, unit: 'USD' }
  ];

  metrics.forEach(m => console.log(formatMetric(m)));
}

if (require.main === module) {
  main();
}
