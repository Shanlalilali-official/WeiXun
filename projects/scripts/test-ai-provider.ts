import { createServer } from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';

async function main() {
  const attempts = new Map<string, number>();
  const requestPayloads: Array<{
    model: string;
    thinking?: { type?: string };
  }> = [];
  const server = createServer((request, response) => {
    if (request.url !== '/v1/chat/completions' || request.method !== 'POST') {
      response.writeHead(404).end();
      return;
    }

    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const payload = JSON.parse(body) as {
        stream?: boolean;
        model: string;
        response_format?: { type?: string };
        thinking?: { type?: string };
      };
      requestPayloads.push(payload);
      const count = (attempts.get(payload.model) ?? 0) + 1;
      attempts.set(payload.model, count);
      if (request.headers.authorization !== 'Bearer local-test-key') {
        response.writeHead(401).end();
        return;
      }
      if (payload.model === 'always-unauthorized') { response.writeHead(401).end('sensitive-provider-body'); return; }
      if (payload.model === 'always-unavailable' || (payload.model === 'retry-once' && count === 1)) {
        response.writeHead(503).end('sensitive-provider-body'); return;
      }
      if (payload.model === 'broken-stream') {
        response.writeHead(200, { 'Content-Type': 'text/event-stream' });
        response.end('data: {"choices":[{"delta":{"content":"partial"}}]}\n\ndata: {"error":{"message":"sensitive-provider-body"}}\n\n');
        return;
      }
      if (!payload.stream) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ choices: [{ message: { content: payload.response_format ? '{"ok":true}' : '普通响应通过' } }] }));
        return;
      }

      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.write('data: {"choices":[{"delta":{"content":"流式"}}]}\n\n');
      response.end('data: {"choices":[{"delta":{"content":"响应通过"}}]}');
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('MOCK_SERVER_ADDRESS_FAILED');

  process.env.AI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  process.env.AI_API_KEY = 'local-test-key';
  process.env.AI_MODEL = 'local-test-model';

  try {
    const { invokeLLM, streamLLM } = await import('../src/lib/ai/client');
    const response = await invokeLLM([{ role: 'user', content: 'test' }]);
    if (response !== '普通响应通过') throw new Error(`INVOKE_MISMATCH: ${response}`);
    const defaultThinkingResponse = await invokeLLM([{ role: 'user', content: 'default thinking test' }], { thinking: 'disabled' });
    assert.equal(defaultThinkingResponse, '普通响应通过');
    assert.equal(requestPayloads[requestPayloads.length - 1].thinking, undefined, 'Default provider must not forward thinking');

    process.env.DOUBAO_AI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
    process.env.DOUBAO_AI_API_KEY = 'local-test-key';
    process.env.DOUBAO_AI_MODEL = 'doubao-local-model';
    const doubaoThinkingResponse = await invokeLLM(
      [{ role: 'user', content: 'doubao thinking test' }],
      { provider: 'doubao', thinking: 'disabled' },
    );
    assert.equal(doubaoThinkingResponse, '普通响应通过');
    assert.deepEqual(requestPayloads[requestPayloads.length - 1].thinking, { type: 'disabled' });

    const jsonResponse = await invokeLLM([{ role: 'user', content: 'json test' }], { jsonMode: true });
    if (jsonResponse !== '{"ok":true}') throw new Error(`JSON_MODE_MISMATCH: ${jsonResponse}`);

    let streamed = '';
    for await (const chunk of streamLLM([{ role: 'user', content: 'test stream' }])) {
      streamed += chunk;
    }
    if (streamed !== '流式响应通过') throw new Error(`STREAM_MISMATCH: ${streamed}`);
    assert.equal(await invokeLLM([{ role: 'user', content: 'retry' }], { model: 'retry-once' }), '普通响应通过');
    assert.equal(attempts.get('retry-once'), 2);
    await assert.rejects(invokeLLM([], { model: 'always-unavailable' }), /^Error: AI_PROVIDER_HTTP_503$/);
    assert.equal(attempts.get('always-unavailable'), 2, 'Retries must be bounded');
    await assert.rejects(invokeLLM([], { model: 'always-unauthorized' }), /^Error: AI_PROVIDER_HTTP_401$/);
    assert.equal(attempts.get('always-unauthorized'), 1, 'Invalid credentials must not retry');
    await assert.rejects(async () => {
      for await (const chunk of streamLLM([], { model: 'broken-stream' })) { assert.equal(chunk, 'partial'); }
    }, /^Error: AI_PROVIDER_STREAM_PROTOCOL$/);
    assert.equal(attempts.get('broken-stream'), 1, 'Never replay a stream after output starts');
    console.log('AI Provider 普通响应与流式响应测试通过。');
  } finally {
    server.close();
    await once(server, 'close');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
