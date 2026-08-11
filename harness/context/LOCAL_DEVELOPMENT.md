# 本地开发环境

项目不再依赖 Coze。应用运行需要 Node.js 20+、pnpm 9+；本地数据库需要 Docker Desktop 与 Supabase CLI；AI 使用任意兼容 OpenAI Chat Completions 的模型服务。

## 首次设置

在 `projects/` 执行：

```powershell
pnpm install
./scripts/setup-local.ps1
```

Windows 可用 `scoop install supabase` 安装 Supabase CLI。脚本不会覆盖已有 `.env.local`，启动数据库后会显示本地连接信息。

复制并填写环境变量：

```powershell
Copy-Item .env.example .env.local
pnpm local:check
```

模型变量为 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`、`AI_REQUEST_TIMEOUT_MS`。数据库变量为 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。真实值不得提交、写入日志或发送到浏览器。

## 数据库

- 配置：`projects/supabase/config.toml`
- 迁移目录：`projects/supabase/migrations/`（完整初始结构及主键/RLS 修正按顺序执行）
- 初始数据：`projects/supabase/seed.sql`
- 重建命令：`pnpm supabase:reset`（会清空本地数据）

当前机器尚未完成 Docker/Supabase CLI 启动验证，因此数据库纵向冒烟仍为阻塞项。

## 验证

```powershell
pnpm ts-check
pnpm lint:build
pnpm test:ai-provider
pnpm test:game-state
pnpm test:metrics
pnpm build
```

`test:ai-provider` 使用本地 mock，不需要真实 API key；真实模型稳定性仍须在填入 key 后验证。
