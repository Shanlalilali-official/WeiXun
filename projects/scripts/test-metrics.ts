import assert from 'node:assert/strict';
import { aMetrics, cMetrics } from '../src/lib/metrics-data';
import { validateMetricFormula } from '../src/lib/metrics-validation';

const knownATags = new Set(aMetrics.map((metric) => metric.tag));
const c0 = cMetrics.find((metric) => metric.tag === 'C0');
assert.ok(c0, 'C0 metric must exist');

const c0Issues = validateMetricFormula(c0.formula, knownATags);
assert.ok(
  c0Issues.some((issue) => issue.type === 'unknown-reference' && issue.detail === 'A314'),
  'validator must keep detecting the unresolved A314 reference until the business formula is confirmed',
);

const validFormulaIssues = validateMetricFormula('MAX(50,MIN(100,A13+A34))', knownATags);
assert.deepEqual(validFormulaIssues, []);

console.log('metrics validation tests passed; C0 remains intentionally blocked');
