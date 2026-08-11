import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}

const required = [
  'AI_BASE_URL',
  'AI_API_KEY',
  'AI_MODEL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`本地环境未就绪，缺少变量：${missing.join(', ')}`);
  console.error('请复制 .env.example 为 .env.local，再填入本地 Supabase 信息和模型 API key。');
  process.exitCode = 1;
} else {
  console.log('本地环境变量检查通过（仅检查变量是否存在，未输出任何密钥）。');
}
