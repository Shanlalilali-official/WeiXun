# 本地开发环境

项目不再依赖 Coze。应用运行需要 Node.js 20+、pnpm 9+；当前开发流程使用托管 Supabase，不要求 Docker Desktop；AI 使用任意兼容 OpenAI Chat Completions 的模型服务。

## 日常一键启动

在 Windows 资源管理器中双击仓库根目录的 `start-project.bat`。脚本会依次检查环境变量和托管数据库连通性；构建缺失或源码/关键配置晚于生产构建时自动重建。默认尝试 `http://127.0.0.1:5000/`；端口上只有构建号一致且数据库健康的本项目服务才会被复用，否则自动尝试后续端口并打开实际地址。服务运行期间保留命令行窗口，关闭窗口即停止服务。

## 首次设置

在 `projects/` 执行：

```powershell
pnpm install
./scripts/setup-local.ps1
```

Windows 可用 `scoop install supabase` 安装 Supabase CLI。脚本不会覆盖已有 `.env.local`；当前托管流程使用 `supabase link` 和 `supabase db push --include-seed`，无需启动 Docker。

复制并填写环境变量：

```powershell
Copy-Item .env.example .env.local
pnpm local:check
```

模型变量为 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`、`AI_REQUEST_TIMEOUT_MS`。数据库变量为 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`。建议另设 `GAME_RANDOM_SECRET` 用于游戏概率签名；未设置时服务端回退到 `SESSION_SECRET` 或 service-role key。真实值不得提交、写入日志或发送到浏览器。

## 数据库

- 配置：`projects/supabase/config.toml`
- 迁移目录：`projects/supabase/migrations/`（完整初始结构及主键/RLS 修正按顺序执行）
- 初始数据：`projects/supabase/seed.sql`
- 重建命令：`pnpm supabase:reset`（会清空本地数据）

当前机器已完成 Supabase CLI 项目关联、迁移、seed 和托管数据库纵向冒烟。`20260817000100_single_active_game_session.sql` 已推送，用事务 RPC 和部分唯一索引保证每名玩家只有一个活动存档；数据库环境不再阻塞开发。

## 验证

```powershell
pnpm ts-check
pnpm lint:build
pnpm test:ai-provider
pnpm test:game-state
pnpm test:metrics
pnpm build
```

`test:ai-provider` 使用本地 mock，不需要真实 API key；`test:e2e` 会访问已配置的托管数据库和真实模型服务。
