import assert from 'node:assert/strict';
import { buildReviewContext, toReviewOutcome, type StoredChatMessage, type StoredGameEvent } from '../src/lib/game/repository';
import { createProjectOneState, getGameOutcome } from '../src/lib/game/state';

const base = createProjectOneState();
const state = {
  ...base,
  conversationMemories: {
    'p1-frontline-wang-hao': {
      summary: '第81条以后客户确认试点范围，并承诺下周给出接口负责人。',
      summarizedMessageCount: 84,
      confirmedFacts: ['第81条以后确认试点范围'],
      commitments: ['客户承诺下周给出接口负责人'],
    },
  },
  complianceRisks: [{
    id: 'risk:late:1',
    npcId: 'p1-frontline-wang-hao',
    preparationId: 'gift-late',
    kind: 'explicit_bribe' as const,
    severity: 5,
    status: 'triggered' as const,
    penalty: 20,
    reason: '第81条以后明确提出以利益交换支持，已触发合规风险。',
    createdRound: 5,
    triggerRound: 5,
    outcome: 'reported' as const,
  }],
  competitorState: {
    ...base.competitorState,
    pressureScore: 99,
    actions: [{
      id: 'competitor:hidden',
      round: 5,
      targetNpcId: 'p1-frontline-wang-hao',
      kind: 'price' as const,
      title: '隐藏竞品动作',
      summary: 'HIDDEN_COMPETITOR_SECRET',
      pressureDelta: 9,
      supportImpact: -9,
      mitigated: false,
    }],
  },
};

const transcript: StoredChatMessage[] = Array.from({ length: 100 }, (_, index) => ({
  id: `message-${index + 1}`,
  role: index % 2 ? 'assistant' : 'user',
  content: `第${index + 1}条对话`,
  round: Math.ceil((index + 1) / 20),
  createdAt: `2026-08-31T00:00:${String(index).padStart(2, '0')}.000Z`,
  metadata: { npcId: 'p1-frontline-wang-hao' },
}));

const events: StoredGameEvent[] = [
  {
    id: 'event-late-commitment',
    npcId: 'p1-frontline-wang-hao',
    round: 5,
    eventType: 'npc.turn.completed',
    payload: {
      npcId: 'p1-frontline-wang-hao',
      commitments: ['第81条以后客户承诺下周给出接口负责人'],
      confirmedFacts: ['第81条以后确认试点范围'],
      semanticFlags: { riskyConduct: true, explicitQuidProQuo: true },
      hiddenCompetitorPressure: 99,
    },
    createdAt: '2026-08-31T01:00:00.000Z',
  },
  {
    id: 'event-old-gift',
    npcId: 'p1-frontline-wang-hao',
    round: 4,
    eventType: 'gift.delivered',
    payload: {
      preparationId: 'gift-late',
      disposition: 'reported',
      riskId: 'risk:late:1',
      reason: '明确利益交换',
      secretCompetitorAction: 'HIDDEN_COMPETITOR_SECRET',
    },
    createdAt: '2026-08-31T00:30:00.000Z',
  },
  {
    id: 'event-hidden-competitor',
    npcId: null,
    round: 5,
    eventType: 'competitor.internal',
    payload: { pressureScore: 99, summary: 'HIDDEN_COMPETITOR_SECRET' },
    createdAt: '2026-08-31T01:30:00.000Z',
  },
  {
    id: 'event-phase',
    npcId: null,
    round: 5,
    eventType: 'phase.advanced',
    payload: {
      fromRound: 4,
      toRound: 5,
      competitorActionKind: 'price',
      competitorActionMitigated: false,
      complianceRiskCount: 1,
    },
    createdAt: '2026-08-31T02:00:00.000Z',
  },
];

const context = buildReviewContext({ state, transcript, events });
assert.equal(context.recentMessages.length, 32, 'review keeps a bounded newest message tail');
assert.equal(context.recentMessages[0]?.id, 'message-69');
assert.equal(context.recentMessages.at(-1)?.id, 'message-100');
assert.equal(context.recentMessages.some((message) => message.id === 'message-1'), false, 'old raw transcript is not sent wholesale');

const memory = context.npcMemories['p1-frontline-wang-hao'];
assert.ok(memory?.summary.includes('第81条以后'));
assert.ok(memory?.confirmedFacts.includes('第81条以后确认试点范围'));
assert.ok(memory?.commitments.includes('客户承诺下周给出接口负责人'));
assert.equal(context.persistentState.complianceRisks instanceof Array, true);
assert.equal(context.keyEvents.some((event) => event.id === 'event-late-commitment'), true);
assert.equal(context.keyEvents.some((event) => event.id === 'event-old-gift'), true);
assert.equal(context.keyEvents.some((event) => event.id === 'event-hidden-competitor'), false);

const serializedContext = JSON.stringify(context);
assert.equal(serializedContext.includes('HIDDEN_COMPETITOR_SECRET'), false, 'hidden competitor values never enter review context');
assert.equal(serializedContext.includes('competitorActionKind'), false, 'hidden competitor event fields are allowlisted out');
assert.equal(serializedContext.includes('pressureScore'), false, 'hidden competitor score is omitted');

const safeOutcome = toReviewOutcome(getGameOutcome(state));
assert.equal('competitorScore' in safeOutcome, false, 'review outcome omits hidden competitor score');
assert.equal('competitivePosition' in safeOutcome, false, 'review outcome omits hidden competitor position');

console.log('review context regression tests passed');
