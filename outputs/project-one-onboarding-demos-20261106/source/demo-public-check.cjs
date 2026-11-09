'use strict';

const assert = require('node:assert/strict');
const raw = require('./demo-data.js');
const toPublicDemoData = require('./demo-public.js');

const projected = toPublicDemoData(raw);
const projectedText = JSON.stringify(projected);
const scenarioKeys = Object.keys(raw.scenarios);
const publicScenarioFields = [
  'id', 'industryId', 'businessId', 'projectName', 'clientName', 'description',
  'overview', 'goals', 'facts', 'details', 'peopleRoles',
];

assert.equal(scenarioKeys.length, 12);
assert.deepEqual(Object.keys(projected).sort(), ['businesses', 'industries', 'notice', 'people', 'scenarios', 'version']);
for (const person of projected.people) {
  assert.deepEqual(Object.keys(person).sort(), ['id', 'name', 'photoAsset']);
}
for (const category of [...projected.industries, ...projected.businesses]) {
  assert.deepEqual(Object.keys(category).sort(), ['description', 'icon', 'id', 'label']);
}
for (const scenario of Object.values(projected.scenarios)) {
  assert.deepEqual(Object.keys(scenario), publicScenarioFields);
  for (const fact of scenario.facts) {
    assert.deepEqual(Object.keys(fact).sort(), ['label', 'note', 'value']);
  }
  for (const section of scenario.details) {
    assert.ok(section.items.length > 0, 'empty detail groups must be omitted');
    for (const item of section.items) {
      assert.equal(item.status, '公开');
      assert.deepEqual(Object.keys(item).sort(), ['label', 'status', 'value']);
    }
  }
}

const contaminated = structuredClone(raw);
contaminated.internalPrompt = 'PRIVATE_TOP_LEVEL_SENTINEL';
contaminated.scenarios['manufacturing+management'].privateChecklist = 'PRIVATE_SCENARIO_SENTINEL';
contaminated.scenarios['manufacturing+management'].facts.push({
  label: '内部范围', value: 'PENDING_VALUE_SENTINEL', note: '待确认',
});
contaminated.scenarios['manufacturing+management'].details[0].items.push({
  label: '未知公开项', value: 'UNKNOWN_ITEM_SECRET_SENTINEL', status: '公开',
});
const contaminatedProjection = JSON.stringify(toPublicDemoData(contaminated));
for (const sentinel of [
  'internalPrompt', 'PRIVATE_TOP_LEVEL_SENTINEL', 'privateChecklist',
  'PRIVATE_SCENARIO_SENTINEL', '内部范围', 'PENDING_VALUE_SENTINEL',
  'UNKNOWN_ITEM_SECRET_SENTINEL', '未知公开项', '待沟通', '待确认',
]) {
  assert.equal(contaminatedProjection.includes(sentinel), false, `projection leaked ${sentinel}`);
}

const unknownStatus = structuredClone(raw);
unknownStatus.scenarios['manufacturing+management'].details[0].items.push({
  label: '未知状态项', value: 'UNKNOWN_STATUS_SECRET_SENTINEL', status: '未定义',
});
assert.throws(() => toPublicDemoData(unknownStatus), /unknown status/);

const addedScenario = structuredClone(raw);
addedScenario.scenarios['manufacturing+security'] = { id: 'new-scenario' };
assert.throws(() => toPublicDemoData(addedScenario), /audited public scenario set/);

const missingScenario = structuredClone(raw);
delete missingScenario.scenarios['finance+security'];
assert.throws(() => toPublicDemoData(missingScenario), /audited public scenario set/);

console.log('Public projection canary passed (12 scenarios, whitelist, private-field stripping, unknown status/item and scenario fail-closed).');
