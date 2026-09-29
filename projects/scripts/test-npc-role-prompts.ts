import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_PROJECT_ONE_PROMPT_CONFIG } from '../src/lib/designer/prompt-config';
import { PROJECT_ONE_NPC_ROLE_PROMPTS } from '../src/lib/designer/npc-role-prompts';
import {
  PROJECT_ONE_FIVE_PERSON_IDS,
  PROJECT_ONE_FIVE_PERSON_NPCS,
} from '../src/lib/designer/project-one-five-person';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260920000300_enrich_five_npc_backgrounds.sql'),
  'utf8',
);
const perspectiveMigration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260929000100_npc_speaker_perspective.sql'),
  'utf8',
);
assert.match(perspectiveMigration, /saved\.id = 'project-one'/);
assert.match(perspectiveMigration, /npcRolePrompts/);
assert.match(perspectiveMigration, /revision = saved\.revision \+ 1/);

for (const [index, npcId] of PROJECT_ONE_FIVE_PERSON_IDS.entries()) {
  const prompt = PROJECT_ONE_NPC_ROLE_PROMPTS[npcId];
  const npc = PROJECT_ONE_FIVE_PERSON_NPCS[npcId];
  assert.ok(prompt.length >= 2_500, `${npc.name} prompt should be complete`);
  assert.ok(prompt.length <= 12_000, `${npc.name} prompt exceeds editable field limit`);
  assert.match(prompt, new RegExp(`姓名：${npc.name}`));
  assert.match(prompt, new RegExp(`职务：${npc.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  for (const section of ['角色身份与人称规则', '一、人物定位', '人物背景和当前处境', '二、话题判断', '三、对话动作去重复', '四、终止交流', '五、回复长度和语气', '六、支持度只改变哪些内容', '七、参考话术锚点', '八、安全和信息边界', '九、输出规则']) {
    assert.match(prompt, new RegExp(section), `${npc.name} is missing ${section}`);
  }
  assert.ok(
    prompt.includes(`你就是${npc.name}；玩家始终是外部销售方或供应商，不是任何 NPC，也不是你扮演的角色。`),
    `${npc.name} must be explicitly distinguished from the player`,
  );
  assert.ok(
    prompt.includes('所有直接针对你的角色职责、判断、行动、限制和回复要求，都以第二人称“你”理解'),
    `${npc.name} role rules must use second person`,
  );
  assert.ok(prompt.includes('人物背景、第三方人物指代和原始参考话术保留原有对象'), `${npc.name} must preserve third-party and quoted references`);
  assert.ok(prompt.includes('你的主要职责是：'), `${npc.name} duties must directly address the NPC`);
  assert.ok(
    prompt.includes('站在你的第一人称立场表达；不替玩家发言，也不以供应商身份自称'),
    `${npc.name} output rules must keep the NPC and player voices separate`,
  );
  assert.match(prompt, /(晋升|职业生涯|更大管理责任|更重要的项目机会|独立扛住|更大的协作空间)/, `${npc.name} is missing career motivation`);
  assert.match(prompt, /(家中|家里|家庭|伴侣|生活)/, `${npc.name} is missing a current personal or family concern`);
  for (const channel of ['电话', '微信', '邮件', '拜访']) assert.match(prompt, new RegExp(channel), `${npc.name} background is missing ${channel} behavior`);
  assert.match(prompt, /不要求.{0,10}每轮输出心理活动/, `${npc.name} background must remain latent`);
  assert.match(prompt, /如果系统要求输出 JSON 或其他固定结构/);
  assert.doesNotMatch(prompt, /读完这条配置消息后，只回复/);
  assert.equal(DEFAULT_PROJECT_ONE_PROMPT_CONFIG.npcRolePrompts[npcId], prompt);

  const tag = `background_${index + 1}`;
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = `'${npcId}', \\$${escapedTag}\\$([\\s\\S]*?)\\$${escapedTag}\\$`;
  const match = migration.match(new RegExp(pattern));
  assert.ok(match, `${npc.name} historical prompt snapshot is missing from migration`);
  assert.ok(match[1].length >= 2_500, `${npc.name} historical prompt snapshot should be complete`);
  assert.match(match[1], new RegExp(`姓名：${npc.name}`));
  assert.match(match[1], new RegExp(`职务：${npc.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(match[1], /九、输出规则/);
  assert.doesNotMatch(match[1], /角色身份与人称规则/, `${npc.name} old migration should remain a historical snapshot`);

  const newTag = `perspective_${index + 1}`;
  const newPattern = `'${npcId}', \\$${newTag}\\$([\\s\\S]*?)\\$${newTag}\\$`;
  const newMatch = perspectiveMigration.match(new RegExp(newPattern));
  assert.ok(newMatch, `${npc.name} updated prompt is missing from migration`);
  assert.equal(newMatch[1], prompt, `${npc.name} migration prompt must match the code default`);
}

assert.deepEqual(
  Object.keys(PROJECT_ONE_NPC_ROLE_PROMPTS).sort(),
  [...PROJECT_ONE_FIVE_PERSON_IDS].sort(),
);

console.log('五人人物完整提示词专项测试通过');
