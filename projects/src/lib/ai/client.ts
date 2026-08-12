export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type InvokeOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  thinking?: 'enabled' | 'disabled';
};

interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | Array<{ type?: string; text?: string }> };
  }>;
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: { content?: string | Array<{ type?: string; text?: string }> };
  }>;
}

function getAiConfig(): AiConfig {
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const apiKey = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!baseUrl) throw new Error('AI_BASE_URL_NOT_SET');
  if (!apiKey) throw new Error('AI_API_KEY_NOT_SET');
  if (!model) throw new Error('AI_MODEL_NOT_SET');
  const configuredTimeout = Number(process.env.AI_REQUEST_TIMEOUT_MS || 60_000);
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey,
    model,
    timeoutMs: Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 60_000,
  };
}

function chatCompletionsUrl(baseUrl: string): string {
  return baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
}

function extractText(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((block) => block.type === 'text' ? (block.text || '') : '').join('');
}

async function requestCompletion(
  messages: ChatMessage[],
  options: InvokeOptions | undefined,
  stream: boolean,
): Promise<Response> {
  const config = getAiConfig();
  const response = await fetch(chatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model || config.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        ...(options?.thinking && /(^|\.)deepseek\.com$/i.test(new URL(config.baseUrl).hostname)
          ? { thinking: { type: options.thinking } }
          : {}),
        stream,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`AI_PROVIDER_HTTP_${response.status}`);
  }
  return response;
}

export async function invokeLLM(
  messages: ChatMessage[],
  options?: InvokeOptions,
): Promise<string> {
  const response = await requestCompletion(messages, options, false);
  const payload = await response.json() as ChatCompletionResponse;
  const content = extractText(payload.choices?.[0]?.message?.content);
  if (!content) throw new Error('AI_PROVIDER_EMPTY_RESPONSE');
  return content;
}

export async function* streamLLM(
  messages: ChatMessage[],
  options?: InvokeOptions,
): AsyncGenerator<string, void, undefined> {
  const response = await requestCompletion(messages, options, true);
  if (!response.body) throw new Error('AI_PROVIDER_STREAM_UNAVAILABLE');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const parseLine = (line: string): string => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return '';
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') return '';
    try {
      const chunk = JSON.parse(data) as ChatCompletionChunk;
      return extractText(chunk.choices?.[0]?.delta?.content);
    } catch {
      return '';
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      const content = parseLine(line);
      if (content) yield content;
    }
  }
  buffer += decoder.decode();
  const finalContent = parseLine(buffer);
  if (finalContent) yield finalContent;
}
