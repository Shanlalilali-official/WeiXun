import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  composeNpcRolePrompt,
  DEFAULT_NPC_SUPPORT_TIER_THRESHOLDS,
  DEFAULT_PROJECT_ONE_PROMPT_CONFIG,
  normalizeNpcRolePrompt,
  normalizeProjectOnePromptConfig,
  supportPromptTier,
} from '../src/lib/designer/prompt-config';
import {
  PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES,
  PROJECT_ONE_NPC_ROLE_PROMPTS,
} from '../src/lib/designer/npc-role-prompts';
import { PROJECT_ONE_FIVE_PERSON_IDS, PROJECT_ONE_FIVE_PERSON_NPCS } from '../src/lib/designer/project-one-five-person';

const perspectiveMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260929000100_npc_speaker_perspective.sql'),
  'utf8',
);
const september30ProfileSnapshot = JSON.parse(readFileSync(
  resolve(process.cwd(), 'scripts/fixtures/npc-role-prompts-2026-09-30.json'),
  'utf8',
)) as typeof PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES;
const october8PreRefreshProfileSnapshot = JSON.parse(readFileSync(
  resolve(process.cwd(), 'scripts/fixtures/npc-role-prompts-2026-10-08-before-tone-refresh.json'),
  'utf8',
)) as typeof PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES;
const october8BeforeTierScenariosProfileSnapshot = JSON.parse(readFileSync(
  resolve(process.cwd(), 'scripts/fixtures/npc-role-prompts-2026-10-08-before-tier-scenarios.json'),
  'utf8',
)) as typeof PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES;
const october12BeforeShortRepliesProfileSnapshot = JSON.parse(readFileSync(
  resolve(process.cwd(), 'scripts/fixtures/npc-role-prompts-2026-10-12-before-short-replies.json'),
  'utf8',
)) as typeof PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES;
const historicalProfileSnapshots: readonly [string, typeof PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES][] = [
  ['September 30', september30ProfileSnapshot],
  ['October 8 pre-refresh', october8PreRefreshProfileSnapshot],
  ['October 8 before tier scenarios', october8BeforeTierScenariosProfileSnapshot],
  ['October 12 before short replies', october12BeforeShortRepliesProfileSnapshot],
];

const NPC_CATCHPHRASE_PATTERNS: Record<(typeof PROJECT_ONE_FIVE_PERSON_IDS)[number], RegExp> = {
  'P1-001': /确实，确实|这事我琢磨琢磨|要不这样，您看/,
  'P1-002': /嗯，是这么个意思|怎么说呢|您看啊/,
  'P1-003': /您说是不是|这个嘛|话说回来/,
  'P1-004': /嗯嗯，是这样|怎么讲呢|您看哈/,
  'P1-005': /哎，是呢|您看这样好不好|那咱们这样/,
};

const PERSONIFIED_SCENARIO_PATTERN = /^- 对方(?:询问项目背景或技术细节|介绍公司或方案|询问下一步)时，可说：“([^”]+)”$/gm;
const COMMON_SALES_SCENARIO_SECTION_PATTERN = /(?:^|\n)常见销售场景（[^）]+）：\n([\s\S]*?)(?=\n本档追加示例：|\s*$)/;

function commonSalesScenarioReplies(prompt: string, npcName: string, tier: string): Map<string, string> {
  const section = prompt.match(COMMON_SALES_SCENARIO_SECTION_PATTERN)?.[1];
  assert.ok(section, `${npcName} ${tier} has a delimited common sales scenarios section`);
  const replies = new Map<string, string>();
  for (const line of section.split(/\r?\n/)) {
    const match = line.match(/^- (.+?)[，；]可说：“([^”]+)”$/);
    if (match) {
      assert.ok(!replies.has(match[1]), `${npcName} ${tier} does not duplicate scenario label ${match[1]}`);
      replies.set(match[1], match[2]);
    }
  }
  return replies;
}

for (const [index, npcId] of PROJECT_ONE_FIVE_PERSON_IDS.entries()) {
  const npc = PROJECT_ONE_FIVE_PERSON_NPCS[npcId];
  const baseline = PROJECT_ONE_NPC_ROLE_PROMPTS[npcId];
  const profile = PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES[npcId];

  assert.equal(baseline, profile.base, `${npc.name} baseline export stays aligned with the profile`);
  assert.ok(baseline.length >= 400 && baseline.length <= 800, `${npc.name} baseline retains concise, usable character context`);
  assert.match(baseline, new RegExp(`你是客户 NPC ${npc.name}`));
  assert.match(baseline, new RegExp(npc.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(baseline, /人物背景：/);
  assert.match(baseline, /职责：/);
  assert.match(baseline, /固定边界：/);
  assert.match(baseline, /口头语：/);
  assert.match(baseline, /每轮最多一处/);
  assert.match(baseline, NPC_CATCHPHRASE_PATTERNS[npcId], `${npc.name} has individual catchphrases`);
  assert.doesNotMatch(baseline, /支持度|参考话术|当前支持度/);

  for (const tier of ['low', 'medium', 'high'] as const) {
    assert.ok(profile[tier].length >= 800, `${npc.name} ${tier} contains broad concrete reply guidance`);
    assert.ok(profile[tier].length <= 12_000, `${npc.name} ${tier} stays within the editable prompt limit`);
    assert.match(profile[tier], /以下示例只用于动作和语气参考/);
    assert.match(profile[tier], /本档追加示例/);
    assert.ok((profile[tier].match(/- 玩家/g) ?? []).length >= 2, `${npc.name} ${tier} includes several natural examples`);
    const exampleReplies = [...profile[tier].matchAll(/可说：“([^”]+)”/g)].map((match) => match[1]);
    assert.ok(exampleReplies.length >= 10, `${npc.name} ${tier} includes cross-scenario spoken examples`);
    for (const reply of exampleReplies) {
      assert.match(reply, /您|谢谢|抱歉|不好意思|麻烦|请|感谢|还请|不便|方便|谅解/, `${npc.name} ${tier} example stays polite: ${reply}`);
    }
    const personifiedReplies = [...profile[tier].matchAll(PERSONIFIED_SCENARIO_PATTERN)].map((match) => match[1]);
    assert.equal(personifiedReplies.length, 3, `${npc.name} ${tier} has distinct project-info, company-introduction, and next-step examples`);
    assert.match(profile[tier], /人物化情境示例/);
    assert.doesNotMatch(profile[tier], /\[object Object\]|undefined/, `${npc.name} ${tier} has no unresolved scenario interpolation`);
    for (const scenario of ['开场身份不明', '寒暄', '长篇', '询问', '提交材料', '私下', '送礼', '告辞']) {
      assert.match(profile[tier], new RegExp(scenario), `${npc.name} ${tier} covers ${scenario} handling`);
    }
    assert.doesNotMatch(profile[tier], /两次追问后结束|身份不明必须结束/, `${npc.name} ${tier} keeps identity clarification flexible by role`);
    assert.doesNotMatch(profile[tier], /即时愉悦度|支持度以系统|中等支持度表示/);
  }
  assert.match(profile.low, /短句/, `${npc.name} low tier explicitly favors short sentences`);
  assert.match(
    profile.low,
    /(参考|通常|建议)[^\n。]{0,24}\d{1,3}\s*(?:至|[-–—~～])?\s*\d{0,3}\s*字/,
    `${npc.name} low tier gives a numeric reference reply length rather than a hard output cutoff`,
  );
  assert.match(profile.low, /会议|日程|事务/, `${npc.name} low tier defines when a busy reason may be used`);
  assert.match(
    profile.low,
    /(只有|仅当|仅在)[^\n。]{0,32}(本轮|已知|运行事实|依据)[^\n。]{0,32}(会议|日程|事务|安排)/,
    `${npc.name} low tier ties a specific busy reason to information already available`,
  );
  assert.match(
    profile.low,
    /不得[^\n。]{0,12}(虚构|编造|杜撰)[^\n。]{0,16}(会议|日程|安排)/,
    `${npc.name} low tier forbids inventing a meeting or schedule to end a visit`,
  );
  const lowReplyMaxLength = npcId === 'P1-001' ? 40 : 60;
  const lowExampleReplies = [...profile.low.matchAll(/可说：“([^”]+)”/g)].map((match) => match[1]);
  assert.ok(lowExampleReplies.length >= 10, `${npc.name} low tier retains enough concrete short examples to check`);
  for (const reply of lowExampleReplies) {
    assert.ok(
      reply.length <= lowReplyMaxLength,
      `${npc.name} low example is at most ${lowReplyMaxLength} characters including punctuation and catchphrases: ${reply} (${reply.length})`,
    );
  }
  assert.notEqual(profile.low, profile.medium, `${npc.name} low and medium tiers differ`);
  assert.notEqual(profile.medium, profile.high, `${npc.name} medium and high tiers differ`);

  const commonReplies = {
    low: commonSalesScenarioReplies(profile.low, npc.name, 'low'),
    medium: commonSalesScenarioReplies(profile.medium, npc.name, 'medium'),
    high: commonSalesScenarioReplies(profile.high, npc.name, 'high'),
  };
  for (const tier of ['low', 'medium', 'high'] as const) {
    assert.ok(commonReplies[tier].size >= 10, `${npc.name} ${tier} keeps at least ten common sales scenarios`);
  }
  assert.deepEqual(
    [...commonReplies.low.keys()].sort(),
    [...commonReplies.medium.keys()].sort(),
    `${npc.name} low and medium cover the same scenario labels`,
  );
  assert.deepEqual(
    [...commonReplies.medium.keys()].sort(),
    [...commonReplies.high.keys()].sort(),
    `${npc.name} medium and high cover the same scenario labels`,
  );
  for (const label of commonReplies.low.keys()) {
    assert.notEqual(commonReplies.low.get(label), commonReplies.medium.get(label), `${npc.name} low/medium wording differs for ${label}`);
    assert.notEqual(commonReplies.medium.get(label), commonReplies.high.get(label), `${npc.name} medium/high wording differs for ${label}`);
    assert.notEqual(commonReplies.low.get(label), commonReplies.high.get(label), `${npc.name} low/high wording differs for ${label}`);
  }

  const marker = `$perspective_${index + 1}$`;
  const markerStart = perspectiveMigration.indexOf(marker);
  const markerEnd = perspectiveMigration.indexOf(marker, markerStart + marker.length);
  assert.ok(markerStart >= 0 && markerEnd > markerStart, `${npc.name} legacy default exists in the prior migration`);
  const legacyString = perspectiveMigration.slice(markerStart + marker.length, markerEnd);
  const legacyProfile = normalizeNpcRolePrompt(legacyString);

  const savedLegacyString = structuredClone(DEFAULT_PROJECT_ONE_PROMPT_CONFIG);
  savedLegacyString.npcRolePrompts[npcId] = legacyString;
  assert.deepEqual(normalizeProjectOnePromptConfig(savedLegacyString).npcRolePrompts[npcId], profile, `${npc.name} old untouched string upgrades at runtime`);

  const customLegacyString = `${legacyString} `;
  const savedCustomString = structuredClone(DEFAULT_PROJECT_ONE_PROMPT_CONFIG);
  savedCustomString.npcRolePrompts[npcId] = customLegacyString;
  assert.equal(normalizeNpcRolePrompt(normalizeProjectOnePromptConfig(savedCustomString).npcRolePrompts[npcId]).base, customLegacyString, `${npc.name} one-character-scale string change is preserved`);

  const savedLegacyProfile = structuredClone(DEFAULT_PROJECT_ONE_PROMPT_CONFIG);
  savedLegacyProfile.npcRolePrompts[npcId] = legacyProfile;
  assert.deepEqual(normalizeProjectOnePromptConfig(savedLegacyProfile).npcRolePrompts[npcId], profile, `${npc.name} old untouched profile upgrades at runtime`);

  const customLegacyProfile = { ...legacyProfile, medium: `${legacyProfile.medium}\n设计师自定义中档内容` };
  const savedCustomProfile = structuredClone(DEFAULT_PROJECT_ONE_PROMPT_CONFIG);
  savedCustomProfile.npcRolePrompts[npcId] = customLegacyProfile;
  assert.deepEqual(normalizeProjectOnePromptConfig(savedCustomProfile).npcRolePrompts[npcId], customLegacyProfile, `${npc.name} edited profile is never replaced by a default`);

  for (const [snapshotLabel, snapshot] of historicalProfileSnapshots) {
    const preRefreshProfile = snapshot[npcId];
    const savedPreRefreshProfile = structuredClone(DEFAULT_PROJECT_ONE_PROMPT_CONFIG);
    savedPreRefreshProfile.npcRolePrompts[npcId] = preRefreshProfile;
    assert.deepEqual(
      normalizeProjectOnePromptConfig(savedPreRefreshProfile).npcRolePrompts[npcId],
      profile,
      `${npc.name} exact ${snapshotLabel} profile upgrades at runtime`,
    );

    for (const field of ['base', 'low', 'medium', 'high'] as const) {
      const editedPreRefreshProfile = {
        ...preRefreshProfile,
        [field]: `${preRefreshProfile[field]}\n设计师自定义${field}内容`,
      };
      const savedEditedPreRefreshProfile = structuredClone(DEFAULT_PROJECT_ONE_PROMPT_CONFIG);
      savedEditedPreRefreshProfile.npcRolePrompts[npcId] = editedPreRefreshProfile;
      assert.deepEqual(
        normalizeProjectOnePromptConfig(savedEditedPreRefreshProfile).npcRolePrompts[npcId],
        editedPreRefreshProfile,
        `${npc.name} customized ${field} prevents a ${snapshotLabel} profile upgrade`,
      );
    }
  }
}

const wangBase = PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES['P1-003'].base;
assert.match(wangBase, /临近职业生涯的阶段性收口/);
assert.match(wangBase, /伴侣正在整理旧物/);
assert.match(wangBase, /退休后的生活安排/);
assert.doesNotMatch(wangBase, /家里正安排搬迁|更重要的采购职责/);
const zhaoBase = PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES['P1-004'].base;
assert.match(zhaoBase, /长辈正处在恢复期/);
assert.doesNotMatch(zhaoBase, /准备考试/);
const liuBase = PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES['P1-005'].base;
assert.match(liuBase, /职业考试/);
assert.match(liuBase, /亲属搬家/);
assert.doesNotMatch(liuBase, /幼儿接送/);
assert.match(PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES['P1-003'].base, /热情健谈|愿意聊两句/);
assert.doesNotMatch(PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES['P1-003'].base, /不爱寒暄/);
assert.doesNotMatch(PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES['P1-003'].base, /按规矩办更稳妥|材料齐了才好流转/);
assert.doesNotMatch(PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES['P1-004'].base, /我先核对一下|麻烦您把范围说具体些/);
assert.doesNotMatch(PROJECT_ONE_NPC_ROLE_PROMPT_PROFILES['P1-005'].base, /我帮您看看合适窗口|麻烦您把要点发我/);

assert.deepEqual(DEFAULT_NPC_SUPPORT_TIER_THRESHOLDS, { mediumMin: 35, highMin: 70 });
assert.equal(supportPromptTier(0), 'low');
assert.equal(supportPromptTier(34), 'low');
assert.equal(supportPromptTier(35), 'medium');
assert.equal(supportPromptTier(69), 'medium');
assert.equal(supportPromptTier(70), 'high');
assert.equal(supportPromptTier(100), 'high');
const customThresholds = { mediumMin: 40, highMin: 80 };
assert.equal(supportPromptTier(39, customThresholds), 'low');
assert.equal(supportPromptTier(40, customThresholds), 'medium');
assert.equal(supportPromptTier(79, customThresholds), 'medium');
assert.equal(supportPromptTier(80, customThresholds), 'high');

const isolatedProfile = { base: '基础背景', low: '低档正文', medium: '中档正文', high: '高档正文' };
const isolatedLow = composeNpcRolePrompt(isolatedProfile, 39, 50, customThresholds);
const isolatedMedium = composeNpcRolePrompt(isolatedProfile, 40, 50, customThresholds);
const isolatedHigh = composeNpcRolePrompt(isolatedProfile, 80, 50, customThresholds);
assert.match(isolatedLow, /低档正文/);
assert.doesNotMatch(isolatedLow, /中档正文|高档正文|40|80|服务端支持度|档位规则/);
assert.match(isolatedLow, /无论愉悦度高低，始终礼貌客气/);
assert.match(isolatedMedium, /中档正文/);
assert.doesNotMatch(isolatedMedium, /低档正文|高档正文/);
assert.match(isolatedHigh, /高档正文/);
assert.doesNotMatch(isolatedHigh, /低档正文|中档正文/);

assert.deepEqual(Object.keys(PROJECT_ONE_NPC_ROLE_PROMPTS).sort(), [...PROJECT_ONE_FIVE_PERSON_IDS].sort());
console.log('五人人物提示词分档专项测试通过');
