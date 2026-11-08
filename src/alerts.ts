import type { DashboardMetric } from './index';

/** Thresholds are monitoring-demo rules, not clinical or safety limits. */
export type AlertDirection = 'above' | 'below';
export type AlertLevel = 'ok' | 'warning' | 'critical' | 'missing';

export interface MetricAlertRule {
  metricId: string;
  direction: AlertDirection;
  warning: number;
  critical: number;
}

export interface MetricAlert {
  metricId: string;
  direction: AlertDirection;
  value: number | null;
  level: AlertLevel;
  warningThreshold: number;
  criticalThreshold: number;
}

export interface AlertReport {
  alerts: MetricAlert[];
  counts: Record<AlertLevel, number>;
  hasCritical: boolean;
  hasMissing: boolean;
}

function identifier(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 120) {
    throw new RangeError(`${name} must be a non-empty string up to 120 characters`);
  }
  return value.trim();
}

function validRule(rule: MetricAlertRule): void {
  if (!rule || (rule.direction !== 'above' && rule.direction !== 'below')) {
    throw new RangeError('Alert direction must be above or below');
  }
  if (!Number.isFinite(rule.warning) || !Number.isFinite(rule.critical)) {
    throw new RangeError('Alert thresholds must be finite');
  }
  if (rule.direction === 'above' && rule.critical <= rule.warning) {
    throw new RangeError('Above-alert critical threshold must exceed warning');
  }
  if (rule.direction === 'below' && rule.critical >= rule.warning) {
    throw new RangeError('Below-alert critical threshold must be lower than warning');
  }
}

/**
 * Pure threshold evaluation. A configured rule without data is "missing":
 * never silently treat missing telemetry as healthy.
 * All comparisons are inclusive at their configured threshold.
 */
export function evaluateMetricAlerts(
  metrics: readonly DashboardMetric[],
  rules: readonly MetricAlertRule[]
): AlertReport {
  if (!Array.isArray(metrics) || !Array.isArray(rules)) {
    throw new TypeError('Metrics and rules must be arrays');
  }
  const observed = new Map<string, number>();
  for (const metric of metrics) {
    const id = identifier(metric?.id, 'Metric id');
    if (!Number.isFinite(metric.value)) {
      throw new RangeError(`Metric "${id}" must be finite`);
    }
    if (observed.has(id)) throw new RangeError(`Duplicate metric id: ${id}`);
    observed.set(id, metric.value);
  }

  const usedRules = new Set<string>();
  const alerts: MetricAlert[] = [];
  const counts: Record<AlertLevel, number> = {
    ok: 0, warning: 0, critical: 0, missing: 0
  };
  for (const rule of rules) {
    validRule(rule);
    const id = identifier(rule.metricId, 'Rule metric id');
    if (usedRules.has(id)) throw new RangeError(`Duplicate alert rule: ${id}`);
    usedRules.add(id);
    const value = observed.get(id);
    let level: AlertLevel;
    if (value === undefined) {
      level = 'missing';
    } else if (rule.direction === 'above') {
      level = value >= rule.critical ? 'critical' :
        value >= rule.warning ? 'warning' : 'ok';
    } else {
      level = value <= rule.critical ? 'critical' :
        value <= rule.warning ? 'warning' : 'ok';
    }
    counts[level] += 1;
    alerts.push({
      metricId: id, direction: rule.direction, value: value ?? null,
      level, warningThreshold: rule.warning, criticalThreshold: rule.critical
    });
  }
  alerts.sort((a, b) => a.metricId.localeCompare(b.metricId));
  return {
    alerts,
    counts,
    hasCritical: counts.critical > 0,
    hasMissing: counts.missing > 0
  };
}
