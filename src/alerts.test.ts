import { evaluateMetricAlerts, type MetricAlertRule } from './alerts';
import type { DashboardMetric } from './index';

const metric = (id: string, value: number): DashboardMetric => ({
  id, value, title: id, unit: 'units', status: 'optimal'
});

describe('metric threshold alerts', () => {
  test('upper limits are inclusive and sorted by metric ID', () => {
    const rules: MetricAlertRule[] = [
      { metricId: 'z-latency', direction: 'above', warning: 200, critical: 500 },
      { metricId: 'a-errors', direction: 'above', warning: 5, critical: 10 }
    ];
    const report = evaluateMetricAlerts(
      [metric('z-latency', 500), metric('a-errors', 5)], rules
    );
    expect(report.alerts.map(a => [a.metricId, a.level])).toEqual([
      ['a-errors', 'warning'], ['z-latency', 'critical']
    ]);
    expect(report.counts).toEqual({ ok: 0, warning: 1, critical: 1, missing: 0 });
    expect(report.hasCritical).toBe(true);
    expect(report.hasMissing).toBe(false);
  });

  test('lower limits classify capacity below thresholds', () => {
    const rule = [{ metricId: 'free-disk', direction: 'below' as const, warning: 25, critical: 10 }];
    expect(evaluateMetricAlerts([metric('free-disk', 26)], rule).alerts[0].level).toBe('ok');
    expect(evaluateMetricAlerts([metric('free-disk', 25)], rule).alerts[0].level).toBe('warning');
    expect(evaluateMetricAlerts([metric('free-disk', 10)], rule).alerts[0].level).toBe('critical');
    expect(evaluateMetricAlerts([metric('free-disk', 0)], rule).alerts[0].level).toBe('critical');
  });

  test('missing telemetry is not marked healthy and empty rules are valid', () => {
    const missing = evaluateMetricAlerts([], [
      { metricId: 'availability', direction: 'below', warning: 99, critical: 95 }
    ]);
    expect(missing.alerts[0].value).toBeNull();
    expect(missing.alerts[0].level).toBe('missing');
    expect(missing.hasMissing).toBe(true);
    expect(missing.hasCritical).toBe(false);
    expect(missing.counts.missing).toBe(1);
    expect(evaluateMetricAlerts([metric('anything', 2)], []).alerts).toEqual([]);
  });

  test('does not mutate metric data or threshold rules', () => {
    const data = Object.freeze([Object.freeze(metric('latency', 120))]);
    const rules = Object.freeze([Object.freeze({
      metricId: 'latency', direction: 'above' as const, warning: 100, critical: 200
    })]);
    const report = evaluateMetricAlerts(data, rules);
    expect(report.alerts[0].level).toBe('warning');
    expect(data[0].value).toBe(120);
    expect(rules[0].warning).toBe(100);
  });

  test('rejects invalid threshold order, values and unknown direction', () => {
    const input = [metric('errors', 4)];
    const base = { metricId: 'errors', direction: 'above' as const, warning: 5, critical: 10 };
    expect(() => evaluateMetricAlerts(input, [{ ...base, warning: 10 }])).toThrow(RangeError);
    expect(() => evaluateMetricAlerts(input, [{ ...base, critical: Infinity }])).toThrow(RangeError);
    expect(() => evaluateMetricAlerts(input, [{
      metricId: 'errors', direction: 'below', warning: 10, critical: 12
    }])).toThrow(RangeError);
    expect(() => evaluateMetricAlerts(input, [{ ...base, direction: 'invalid' as 'above' }])).toThrow(RangeError);
  });

  test('rejects duplicate identifiers, empty ids, nonfinite metrics and invalid arrays', () => {
    const rule = { metricId: 'errors', direction: 'above' as const, warning: 3, critical: 5 };
    expect(() => evaluateMetricAlerts([metric('errors', 1), metric('errors', 2)], [rule]))
      .toThrow(/Duplicate metric/);
    expect(() => evaluateMetricAlerts([metric('errors', 1)], [rule, rule]))
      .toThrow(/Duplicate alert/);
    expect(() => evaluateMetricAlerts([metric(' ', 3)], [rule])).toThrow(RangeError);
    expect(() => evaluateMetricAlerts([metric('errors', NaN)], [rule])).toThrow(RangeError);
    expect(() => evaluateMetricAlerts(null as unknown as DashboardMetric[], [rule])).toThrow(TypeError);
  });

  test('prototype-like ids are handled safely without object key collisions', () => {
    const rows = [metric('__proto__', 50), metric('constructor', 1)];
    const rules: MetricAlertRule[] = [
      { metricId: '__proto__', direction: 'above', warning: 20, critical: 40 },
      { metricId: 'constructor', direction: 'above', warning: 2, critical: 5 }
    ];
    expect(evaluateMetricAlerts(rows, rules).counts).toEqual({
      ok: 1, warning: 0, critical: 1, missing: 0
    });
  });
});
