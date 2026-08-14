import assert from 'node:assert/strict';
import {
  createFallbackGiftDecision,
  type GiftDecisionContext,
} from '../src/lib/ai/npc-evaluation';

const baseContext: GiftDecisionContext = {
  commandId: 'gift-case-0',
  npcId: 'p1-deputy-zhao-feng',
  npcName: '赵峰',
  npcTitle: '分管业务副主任',
  npcCategory: '高层',
  npcPersonality: '老虎型，年富力强',
  npcConcern: '政绩考核与新项目落地成果',
  complianceSensitivity: 85,
  giftPreference: -3,
  pleasure: 70,
  support: 75,
  attitudeHistory: [],
  giftType: 'boundary',
  giftDescription: '契合其真实兴趣的高价值私人礼品',
  setting: 'private',
  witnesses: [],
  priorBoundaryGiftCount: 0,
  round: 3,
  phaseName: '关系深化',
  meetingType: 'informal',
  venue: '包间',
  procurementSensitive: false,
  exchangeRequested: false,
};

const boundarySamples = Array.from({ length: 120 }, (_, index) => createFallbackGiftDecision({
  ...baseContext,
  commandId: `gift-case-${index}`,
}));
const bestBoundary = boundarySamples.find((item) => item.disposition === 'delighted_acceptance');
assert.ok(bestBoundary, 'stable fallback must preserve a real high-upside boundary-gift outcome');
assert.ok(bestBoundary.pleasureDelta > 4 && bestBoundary.supportDelta > 2,
  'boundary-gift upside must exceed the compliant-gift service limits');
assert.ok(boundarySamples.some((item) => ['firm_rejection', 'reported'].includes(item.disposition)),
  'the same high-volatility choice must also have meaningful downside');

const compliant = createFallbackGiftDecision({
  ...baseContext,
  commandId: 'courtesy-case',
  giftType: 'compliant',
  giftDescription: '公开递交的低价值单位纪念品',
  giftPreference: -1,
  complianceSensitivity: 45,
  support: 55,
  setting: 'public',
});
assert.ok(compliant.pleasureDelta >= -3 && compliant.pleasureDelta <= 4);
assert.ok(compliant.supportDelta >= -2 && compliant.supportDelta <= 2);

const repeated = createFallbackGiftDecision({
  ...baseContext,
  commandId: 'repeat-boundary-case',
  priorBoundaryGiftCount: 1,
});
assert.ok(!['delighted_acceptance', 'cautious_acceptance'].includes(repeated.disposition),
  'one NPC cannot accept a second boundary gift');

const bribe = createFallbackGiftDecision({
  ...baseContext,
  commandId: 'explicit-bribe-case',
  exchangeRequested: true,
});
assert.equal(bribe.disposition, 'reported');
assert.ok(bribe.pleasureDelta <= -10 && bribe.supportDelta <= -8);

console.log('AI attitude and high-volatility gift tests passed');
