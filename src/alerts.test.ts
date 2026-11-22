import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
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
    assert.deepEqual(report.alerts.map(a => [a.metricId, a.level]), [
      ['a-errors', 'warning'], ['z-latency', 'critical']
    ]);
    assert.deepEqual(report.counts, { ok: 0, warning: 1, critical: 1, missing: 0 });
    assert.equal(report.hasCritical, true);
    assert.equal(report.hasMissing, false);
  });

  test('lower limits classify capacity below thresholds', () => {
    const rule = [{ metricId: 'free-disk', direction: 'below' as const, warning: 25, critical: 10 }];
    assert.equal(evaluateMetricAlerts([metric('free-disk', 26)], rule).alerts[0].level, 'ok');
    assert.equal(evaluateMetricAlerts([metric('free-disk', 25)], rule).alerts[0].level, 'warning');
    assert.equal(evaluateMetricAlerts([metric('free-disk', 10)], rule).alerts[0].level, 'critical');
    assert.equal(evaluateMetricAlerts([metric('free-disk', 0)], rule).alerts[0].level, 'critical');
  });

  test('missing telemetry is not marked healthy and empty rules are valid', () => {
    const missing = evaluateMetricAlerts([], [
      { metricId: 'availability', direction: 'below', warning: 99, critical: 95 }
    ]);
    assert.equal(missing.alerts[0].value, null);
    assert.equal(missing.alerts[0].level, 'missing');
    assert.equal(missing.hasMissing, true);
    assert.equal(missing.hasCritical, false);
    assert.equal(missing.counts.missing, 1);
    assert.deepEqual(evaluateMetricAlerts([metric('anything', 2)], []).alerts, []);
  });

  test('does not mutate metric data or threshold rules', () => {
    const data = Object.freeze([Object.freeze(metric('latency', 120))]);
    const rules = Object.freeze([Object.freeze({
      metricId: 'latency', direction: 'above' as const, warning: 100, critical: 200
    })]);
    const report = evaluateMetricAlerts(data, rules);
    assert.equal(report.alerts[0].level, 'warning');
    assert.equal(data[0].value, 120);
    assert.equal(rules[0].warning, 100);
  });

  test('rejects invalid threshold order, values and unknown direction', () => {
    const input = [metric('errors', 4)];
    const base = { metricId: 'errors', direction: 'above' as const, warning: 5, critical: 10 };
    assert.throws(() => evaluateMetricAlerts(input, [{ ...base, warning: 10 }]), RangeError);
    assert.throws(() => evaluateMetricAlerts(input, [{ ...base, critical: Infinity }]), RangeError);
    assert.throws(() => evaluateMetricAlerts(input, [{
      metricId: 'errors', direction: 'below', warning: 10, critical: 12
    }]), RangeError);
    assert.throws(() => evaluateMetricAlerts(input, [{ ...base, direction: 'invalid' as 'above' }]), RangeError);
  });

  test('rejects duplicate identifiers, empty ids, nonfinite metrics and invalid arrays', () => {
    const rule = { metricId: 'errors', direction: 'above' as const, warning: 3, critical: 5 };
    assert.throws(() => evaluateMetricAlerts([metric('errors', 1), metric('errors', 2)], [rule]), /Duplicate metric/);
    assert.throws(() => evaluateMetricAlerts([metric('errors', 1)], [rule, rule]), /Duplicate alert/);
    assert.throws(() => evaluateMetricAlerts([metric(' ', 3)], [rule]), RangeError);
    assert.throws(() => evaluateMetricAlerts([metric('errors', NaN)], [rule]), RangeError);
    assert.throws(() => evaluateMetricAlerts(null as unknown as DashboardMetric[], [rule]), TypeError);
  });

  test('rejects invisible and terminal-control characters in metric identifiers', () => {
    const rule = { metricId: 'latency', direction: 'above' as const, warning: 10, critical: 20 };
    for (const id of ['latency\nnew-line', 'latency\u007f', 'latency\u202e', 'latency\u2066']) {
      assert.throws(() => evaluateMetricAlerts([metric(id, 15)], [rule]), RangeError);
      assert.throws(() => evaluateMetricAlerts([metric('latency', 15)], [{ ...rule, metricId: id }]), RangeError);
    }
    assert.equal(evaluateMetricAlerts([metric('latency', 15)], [rule]).alerts[0].level, 'warning');
  });

  test('prototype-like ids are handled safely without object key collisions', () => {
    const rows = [metric('__proto__', 50), metric('constructor', 1)];
    const rules: MetricAlertRule[] = [
      { metricId: '__proto__', direction: 'above', warning: 20, critical: 40 },
      { metricId: 'constructor', direction: 'above', warning: 2, critical: 5 }
    ];
    assert.deepEqual(evaluateMetricAlerts(rows, rules).counts, {
      ok: 1, warning: 0, critical: 1, missing: 0
    });
  });
});


test('rejects oversized alert evaluation input before scanning or allocating', () => {
  const item = metric('latency', 1);
  const rule: MetricAlertRule = { metricId: 'latency', direction: 'above', warning: 10, critical: 20 };
  assert.throws(() => evaluateMetricAlerts(Array(100001).fill(item), [rule]), /100000/);
  assert.throws(() => evaluateMetricAlerts([item], Array(1001).fill(rule)), /1000/);
  assert.equal(evaluateMetricAlerts([item], [rule]).counts.ok, 1);
});
