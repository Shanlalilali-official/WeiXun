import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET, PUT } from '@/app/api/designer/runtime-prompts/route';
import { detectCustomerActivityProposals } from '@/lib/ai/customer-activities';
import { RUNTIME_RULE_PROMPT_CONFIG_ID } from '@/lib/ai/runtime-rule-prompts';
import { createSession, signSession } from '@/lib/auth/identity';

const activityId = 'customer_activity_detection';
const editedRule = '回归验证专用规则。将“请您吃个便饭”识别为餐叙邀约。';
type Row = { revision: number; config: { overrides: Record<string, string> }; updated_by: string };

async function main() {
  process.env.SUPABASE_URL = 'https://runtime-rule-prompts.invalid';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.SESSION_SECRET = 'runtime-rule-prompt-test';
  const originalFetch = globalThis.fetch;
  let row: Row | undefined;
  const legacy = { revision: 3, config: { liveCustomerPrompt: '既有正式客户提示词。' } };
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.hostname, 'runtime-rule-prompts.invalid');
    assert.equal(url.pathname, '/rest/v1/designer_prompt_configs');
    const method = init?.method ?? 'GET';
    const id = url.searchParams.get('id');
    if (method === 'GET') {
      if (id === 'eq.project-one') return Response.json([legacy]);
      assert.equal(id, `eq.${RUNTIME_RULE_PROMPT_CONFIG_ID}`);
      return Response.json(row ? [row] : []);
    }
    if (method === 'POST') {
      if (row) return Response.json({ code: '23505' }, { status: 409 });
      const inserted = JSON.parse(String(init?.body));
      assert.equal(inserted.id, RUNTIME_RULE_PROMPT_CONFIG_ID);
      row = inserted;
      return Response.json(row, { status: 201 });
    }
    assert.equal(method, 'PATCH');
    assert.equal(id, `eq.${RUNTIME_RULE_PROMPT_CONFIG_ID}`);
    if (!row || url.searchParams.get('revision') !== `eq.${row.revision}`) {
      return Response.json({ code: 'PGRST116', details: 'The result contains 0 rows' }, { status: 406 });
    }
    row = JSON.parse(String(init?.body));
    return Response.json(row);
  };

  const designer = signSession(createSession('runtime-designer', 'platform_designer'));
  const player = signSession(createSession('runtime-player', 'player'));
  const request = (token?: string, body?: unknown) => new NextRequest('http://localhost/api/designer/runtime-prompts', {
    method: body === undefined ? 'GET' : 'PUT',
    headers: token ? { 'x-session': token } : {},
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  try {
    assert.equal((await GET(request())).status, 401);
    assert.equal((await GET(request(player))).status, 403);
    assert.equal((await PUT(request(player, { expectedRevision: 0, overrides: {} }))).status, 403);
    const initial = await (await GET(request(designer))).json();
    assert.equal(initial.revision, 0);
    assert.deepEqual(initial.overrides, {});
    const initialActivity = initial.catalog.find((item: { id: string }) => item.id === activityId);
    assert.ok(initialActivity.defaultText.includes('语义分类'));
    assert.ok(initialActivity.boundary.includes('JSON'));
    assert.equal(initial.catalog.find((item: { id: string }) => item.id === 'formal_customer_dialogue').defaultText, legacy.config.liveCustomerPrompt);
    assert.equal(new Set(initial.catalog.map((item: { id: string }) => item.id)).size, initial.catalog.length);

    assert.equal((await PUT(request(designer, { expectedRevision: 0, overrides: { unknown_task: 'x' } }))).status, 400);
    assert.equal((await PUT(request(designer, { expectedRevision: 0, overrides: { [activityId]: ' ' } }))).status, 400);
    const saved = await PUT(request(designer, { expectedRevision: 0, overrides: { [activityId]: editedRule } }));
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).overrides, { [activityId]: editedRule });
    assert.equal(row?.updated_by, 'runtime-designer');
    assert.equal((await PUT(request(designer, { expectedRevision: 0, overrides: {} }))).status, 409);

    const detect = async (expected: string, edited: boolean) => {
      const proposal = '想请您吃个便饭，顺便也请教您一些问题。';
      const candidates = await detectCustomerActivityProposals({
        conversationEnded: true,
        conversationId: 'runtime-rule-test',
        npcId: 'P1-002',
        messages: [{ messageId: 'invite', speaker: 'sales', text: proposal }],
      }, {
        invoker: async (messages) => {
          assert.ok(messages[0].content.includes(expected));
          assert.equal(messages[0].content.includes(editedRule), edited);
          assert.ok(messages[0].content.includes(initialActivity.boundary));
          return JSON.stringify({
            activities: [{ type: 'hospitality', initiator: 'sales', proposal: { messageId: 'invite', quote: proposal } }],
          });
        },
      });
      assert.equal(candidates[0].type, 'hospitality');
    };
    await detect(editedRule, true);

    assert.equal((await PUT(request(designer, { expectedRevision: 1, overrides: {} }))).status, 200);
    assert.equal((await PUT(request(designer, { expectedRevision: 1, overrides: {} }))).status, 409);
    await detect(initialActivity.defaultText, false);
    console.log(`runtime rule prompt API and live activity injection passed (${initial.catalog.length} catalog entries)`);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
