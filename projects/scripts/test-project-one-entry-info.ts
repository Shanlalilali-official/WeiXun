import assert from 'node:assert/strict';
import { gameCommandSchema } from '../src/lib/contracts/game';
import { PROJECT_ONE_FIVE_PERSON_IDS, PROJECT_ONE_FIVE_PERSON_NPCS } from '../src/lib/designer/project-one-five-person';
import {
  PROJECT_ONE_NPCS,
  PROJECT_ONE_PUBLIC_PROFILES,
  PROJECT_ONE_PUBLIC_RESEARCH_RULE,
} from '../src/lib/game/project-one';
import { createProjectOneState, executeGameCommand } from '../src/lib/game/state';

const expectedDuties: Record<(typeof PROJECT_ONE_FIVE_PERSON_IDS)[number], string> = {
  'P1-001': '负责项目一关键决策与最终方向把关',
  'P1-002': '负责方案推进、需求澄清和跨部门协调',
  'P1-003': '负责采购流程、供应商材料和合规边界把关',
  'P1-004': '负责把需求、任务和方案落到日常执行',
  'P1-005': '接近日常行政协作与内部信息流转',
};

assert.equal(PROJECT_ONE_NPCS.length, PROJECT_ONE_FIVE_PERSON_IDS.length);
for (const npcId of PROJECT_ONE_FIVE_PERSON_IDS) {
  const person = PROJECT_ONE_FIVE_PERSON_NPCS[npcId];
  const runtimeNpc = PROJECT_ONE_NPCS.find((npc) => npc.id === npcId);
  const publicProfile = PROJECT_ONE_PUBLIC_PROFILES[npcId];
  assert.ok(runtimeNpc, `${npcId} remains in the formal roster`);
  assert.equal(runtimeNpc.title, person.title, `${npcId} keeps its title for direct display`);
  assert.ok(person.facts[0].includes(expectedDuties[npcId]), `${npcId} keeps their public responsibilities`);
  assert.ok(!person.facts[0].startsWith(person.title), `${npcId} title is not duplicated as a collected fact`);
  assert.deepEqual(publicProfile.facts, person.facts, `${npcId} public search derives from the revised master`);
  assert.deepEqual(publicProfile.weakSignals, person.clues, `${npcId} public search keeps existing clues`);
}

const initial = createProjectOneState();
assert.deepEqual(initial.publicResearch, {}, 'opening knowledge does not already contain collected public information');
assert.equal(initial.actionPoints, 28);

const command = gameCommandSchema.parse({
  commandId: 'entry-info-wang-public-search',
  type: 'research_public_info',
  payload: { npcId: 'P1-003' },
  expectedVersion: initial.version,
});
const researched = executeGameCommand(initial, command);
const researchedRecord = researched.state.publicResearch['P1-003'];
assert.ok(researchedRecord, 'public search persists the collected facts');
assert.deepEqual(researchedRecord.facts, PROJECT_ONE_PUBLIC_PROFILES['P1-003'].facts);
assert.deepEqual(researchedRecord.weakSignals, PROJECT_ONE_PUBLIC_PROFILES['P1-003'].weakSignals);
assert.equal(researchedRecord.costPoints, PROJECT_ONE_PUBLIC_RESEARCH_RULE.costPoints);
assert.equal(researched.state.actionPoints, initial.actionPoints - PROJECT_ONE_PUBLIC_RESEARCH_RULE.costPoints);
assert.ok(!researchedRecord.facts.includes(PROJECT_ONE_FIVE_PERSON_NPCS['P1-003'].title), 'the title is not revealed again through public search');

console.log('Project-one entry titles, public facts, and the existing public-search flow passed.');
