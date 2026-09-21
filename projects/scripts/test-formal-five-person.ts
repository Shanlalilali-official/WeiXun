import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFallbackNpcEvaluation } from '../src/lib/ai/npc-evaluation';
import { npcTurnEvaluationSchema } from '../src/lib/contracts/ai';
import { PROJECT_ONE_NPCS, getProjectOneNpc } from '../src/lib/game/project-one';
import { createProjectOneState, getGameOutcome } from '../src/lib/game/state';

const EXPECTED_IDS = ['P1-001', 'P1-002', 'P1-003', 'P1-004', 'P1-005'];
const EXPECTED_NAMES = ['张建国', '李明辉', '王德福', '赵晓晨', '刘思琪'];

assert.deepEqual(PROJECT_ONE_NPCS.map((npc) => npc.id), EXPECTED_IDS);
assert.deepEqual(PROJECT_ONE_NPCS.map((npc) => npc.name), EXPECTED_NAMES);
assert.equal(getProjectOneNpc('p1-frontline-wang-hao'), null, 'deleted four-person IDs cannot become formal NPCs');

const state = createProjectOneState();
assert.deepEqual(state.unlockedNpcIds, EXPECTED_IDS);
assert.deepEqual(Object.keys(state.npcContacts), EXPECTED_IDS);
assert.deepEqual(Object.keys(state.npcAttitudes), EXPECTED_IDS);
assert.equal(getGameOutcome(state).supportByNpc['P1-001'], 20);
assert.equal(getGameOutcome(state).supportByNpc['P1-003'], 40);

const evaluation = createFallbackNpcEvaluation({
  npcId: 'P1-004',
  npcName: '赵晓晨',
  npcTitle: '项目执行人员',
  npcPersonality: '谨慎内敛',
  npcCategory: '项目执行',
  npcConcern: '任务边界清楚并能按要求落地',
  affinity: 30,
  support: 30,
  pleasure: 50,
  round: 1,
  playerMessage: '请把执行验证结果向李明辉汇报。',
  npcReply: '我会向李明辉汇报这次执行验证结果。',
  recentConversation: [],
  confirmedFacts: [],
  commitments: [],
});
assert.equal(evaluation.handoff?.targetNpcId, 'P1-002');
assert.equal(npcTurnEvaluationSchema.parse(evaluation).handoff?.targetNpcId, 'P1-002');

const cutoverMigration = readFileSync(
  new URL('../supabase/migrations/20260921000400_replace_project_one_four_person_saves.sql', import.meta.url),
  'utf8',
);
assert.match(cutoverMigration, /DELETE FROM public\.multiplayer_rooms AS room/);
assert.match(cutoverMigration, /DELETE FROM public\.game_sessions AS session/);
assert.match(cutoverMigration, /runtime\.npc_affinity::text/);
assert.match(cutoverMigration, /slot\.initial_personal_info::text/);
assert.doesNotMatch(cutoverMigration, /WHERE scenario_code = 'project-1';/);

console.log('formal five-person backend contracts passed');
