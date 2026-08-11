import { LLMClient } from 'coze-coding-dev-sdk';

let _client: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!_client) {
    _client = new LLMClient();
  }
  return _client;
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type InvokeOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

/**
 * 非流式调用 LLM
 * SDK 签名: invoke(messages: Message[], llmConfig?: LLMConfig, previousResponseId?, extraHeaders?)
 */
export async function invokeLLM(
  messages: ChatMessage[],
  options?: InvokeOptions
): Promise<string> {
  const client = getLLMClient();
  const response = await client.invoke(
    messages,
    {
      model: options?.model ?? 'doubao-seed-2-0-lite-260215',
      temperature: options?.temperature ?? 0.7,
    }
  );
  return response.content;
}

/**
 * 流式调用 LLM
 * 返回 AsyncGenerator，逐块产出字符串内容
 */
export async function* streamLLM(
  messages: ChatMessage[],
  options?: InvokeOptions
): AsyncGenerator<string, void, undefined> {
  const client = getLLMClient();
  const llmStream = await client.stream(
    messages,
    {
      model: options?.model ?? 'doubao-seed-2-0-lite-260215',
      temperature: options?.temperature ?? 0.7,
    }
  );
  for await (const chunk of llmStream) {
    // chunk 是 AIMessageChunk，content 可能是 string 或 ContentBlock[]
    const c = chunk.content;
    if (typeof c === 'string') {
      if (c) yield c;
    } else if (Array.isArray(c)) {
      // ContentBlock[] - 提取 text
      const text = c
        .map((b: { type: string; text?: string }) => (b.type === 'text' && b.text ? b.text : ''))
        .join('');
      if (text) yield text;
    }
  }
}
