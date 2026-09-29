import assert from 'node:assert/strict';
import { connectNpc, createProjectOneState, executeGameCommand, recordMeetingTurn } from '../src/lib/game/state';

let state = connectNpc(createProjectOneState(), 'P1-001');
function command(type: Parameters<typeof executeGameCommand>[1]['type'], payload: Record<string, unknown>, id: string, options: Parameters<typeof executeGameCommand>[2] = {}) {
  const result = executeGameCommand(state, { type, payload, commandId: id, expectedVersion: state.version } as Parameters<typeof executeGameCommand>[1], options);
  state = result.state;
  return result;
}

assert.throws(() => command('work_plan', { scope: 'global', content: '梳理五位关键人物、公开资料、客户问题与下一步拜访安排。' }, 'plan-missing'), /WORK_PLAN_AI_REQUIRED/);
const plan = command('work_plan', { scope: 'global', content: '梳理五位关键人物、公开资料、客户问题与下一步拜访安排。' }, 'plan-1', {
  workPlanEvaluation: { recommendations: ['先核实采购目标。'], disclosures: [{ npcId: 'P1-001', facts: ['负责整体业务方向与关键项目资源协调。'], clues: [] }] },
});
assert.equal(plan.result.workPlan && typeof plan.result.workPlan, 'object');
assert.equal(state.workPlans.length, 1);
assert.equal(state.actionPoints, 27);

command('postal', { npcId: 'P1-001', content: '邮寄项目简介。', attachment: { title: '项目简介', content: '技术能力与交付范围。' } }, 'postal-1');
assert.equal(state.postalRecords.length, 1);
assert.equal(state.actionPoints, 25);

const brief = command('brief_visit', { npcId: 'P1-001', content: '先确认业务目标，再演示精度指标和同类案例，最后约定技术交流负责人。' }, 'brief-1', {
  briefVisitEvaluation: { strengths: ['目标明确。'], risks: ['需要补充预算边界。'], nextStep: '确认技术交流时间。' },
});
assert.equal(brief.result.briefVisit && typeof brief.result.briefVisit, 'object');
assert.equal(state.visitBriefs.length, 1);
assert.equal(state.actionPoints, 23, 'brief visit feedback costs two AP to match the actual-test workflow');
assert.equal(state.activeMeeting, null, 'brief feedback must not create a meeting');
assert.equal(state.appointments.length, 0, 'brief feedback must not create an appointment');

assert.throws(() => command('start_visit', { npcId: 'P1-001', preparationIds: [] }, 'drop-in-no-prep'), /VISIT_PREPARATION_REQUIRED/);
const direct = command('start_visit', { npcId: 'P1-001', preparationIds: [], skipPreparation: true }, 'drop-in-skip');
assert.equal(direct.state.activeMeeting?.maxTurns, 20);
assert.equal(direct.state.appointments.at(-1)?.invitationMethod, 'drop_in');
assert.equal(state.actionPoints, 20, 'direct visit plus explicit skip-preparation risk costs three AP');

state = recordMeetingTurn(state, { completedTask: '提问' });
assert.deepEqual(state.activeMeeting?.completedTasks, ['提问']);
state = recordMeetingTurn(state, { completedTask: '提问' });
assert.equal(state.activeMeeting?.turnCount, 2, 'a repeated task classification still records the dialogue turn');
assert.deepEqual(state.activeMeeting?.completedTasks, ['提问'], 'a repeated task classification is idempotent');
assert.throws(() => recordMeetingTurn(state, { completedTask: '挖坑' }), /MEETING_TASK_NOT_ALLOWED/);
state = recordMeetingTurn(state, { completedTask: '质疑' });
assert.equal(state.activeMeeting, null, 'finishing every configured NPC task ends the visit early');
assert.equal(state.meetingMinutes.at(-1)?.endReason, 'completed');
assert.deepEqual(state.meetingMinutes.at(-1)?.completedTasks, ['提问', '质疑']);

const capped = command('start_visit', { npcId: 'P1-001', preparationIds: [], skipPreparation: true }, 'drop-in-turn-cap');
assert.equal(capped.state.activeMeeting?.maxTurns, 20);
for (let turn = 0; turn < 20; turn += 1) state = recordMeetingTurn(state);
assert.equal(state.activeMeeting, null, 'the twentieth actual visit turn ends the meeting');
assert.match(state.meetingMinutes.at(-1)?.summary ?? '', /上限/);
assert.equal(state.meetingMinutes.at(-1)?.endReason, 'turn_limit', 'the persisted minutes retain why the actual visit ended');

command('start_visit', { npcId: 'P1-001', preparationIds: [], skipPreparation: true }, 'drop-in-npc-left');
state = recordMeetingTurn(state, { npcLeft: true });
assert.equal(state.activeMeeting, null);
assert.equal(state.meetingMinutes.at(-1)?.endReason, 'npc_left', 'a trusted immediate departure remains distinguishable from task completion');

command('start_visit', { npcId: 'P1-001', preparationIds: [], skipPreparation: true }, 'drop-in-player-farewell');
state = { ...state, activeMeeting: { ...state.activeMeeting!, turnCount: 19 } };
state = recordMeetingTurn(state, { playerFarewell: true });
assert.equal(state.activeMeeting, null);
assert.equal(state.meetingMinutes.at(-1)?.endReason, 'player', 'an explicit farewell takes precedence over the turn cap');

console.log('formal workflow state tests passed');
