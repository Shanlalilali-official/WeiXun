import { createServer } from 'node:http';
import { once } from 'node:events';

async function main() {
  const server = createServer((request, response) => {
    if (request.url !== '/v1/chat/completions' || request.method !== 'POST') {
      response.writeHead(404).end();
      return;
    }

    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const payload = JSON.parse(body) as { stream?: boolean };
      if (request.headers.authorization !== 'Bearer local-test-key') {
        response.writeHead(401).end();
        return;
      }
      if (!payload.stream) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ choices: [{ message: { content: '普通响应通过' } }] }));
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

    let streamed = '';
    for await (const chunk of streamLLM([{ role: 'user', content: 'test stream' }])) {
      streamed += chunk;
    }
    if (streamed !== '流式响应通过') throw new Error(`STREAM_MISMATCH: ${streamed}`);
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
