import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false, quiet: true });
}

const required = [
  'AI_BASE_URL',
  'AI_API_KEY',
  'AI_MODEL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const promptTestRequired = [
  'DEEPSEEK_AI_BASE_URL',
  'DEEPSEEK_AI_API_KEY',
  'DEEPSEEK_AI_MODEL',
  'DOUBAO_AI_BASE_URL',
  'DOUBAO_AI_API_KEY',
  'DOUBAO_AI_MODEL',
] as const;

const promptTestMode = process.argv.slice(2).some((argument) => (
  argument === 'prompt-test'
  || argument === '--prompt-test'
  || argument === '--mode=prompt-test'
));
const requiredVariables = promptTestMode ? [...required, ...promptTestRequired] : required;

const missing = requiredVariables.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  const scope = promptTestMode ? '（prompt-test）' : '';
  console.error(`本地环境未就绪${scope}，缺少变量：${missing.join(', ')}`);
  console.error(promptTestMode
    ? '请在 .env.local 中填写对应的命名 Provider 变量，再运行 pnpm local:check:prompt-test。'
    : '请复制 .env.example 为 .env.local，再填入本地 Supabase 信息和模型 API key。');
  process.exitCode = 1;
} else {
  const urlVariables = promptTestMode
    ? ['AI_BASE_URL', 'SUPABASE_URL', 'DEEPSEEK_AI_BASE_URL', 'DOUBAO_AI_BASE_URL']
    : ['AI_BASE_URL', 'SUPABASE_URL'];
  const invalidUrls = urlVariables.filter((name) => {
    try {
      const parsed = new URL(process.env[name]!.trim());
      return parsed.protocol !== 'http:' && parsed.protocol !== 'https:';
    } catch {
      return true;
    }
  });

  if (invalidUrls.length > 0) {
    console.error(`本地环境 URL 格式无效：${invalidUrls.join(', ')}`);
    console.error('URL 必须是以 http:// 或 https:// 开头的完整地址。');
    process.exitCode = 1;
  } else {
    console.log(promptTestMode
      ? '本地环境变量检查通过（已检查默认链路、prompt-test 命名 Provider 和 URL 格式，未输出任何密钥）。'
      : '本地环境变量检查通过（已检查必要变量和 URL 格式，未输出任何密钥）。');
  }
}
