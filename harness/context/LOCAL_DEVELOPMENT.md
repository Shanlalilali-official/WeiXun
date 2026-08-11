# 本地开发与验证

## 运行模式

当前工程有两种运行环境：

1. 扣子工作区：`coze dev/build/start` 提供运行环境，并由扣子托管 `LLMClient` 的模型访问凭证。
2. 普通本地环境：可安装依赖、执行 TypeScript、ESLint 和 Next.js 构建；涉及 AI 的接口只有在具备兼容的扣子运行身份时才能真实调用。

仓库中不保存模型 API Key。当前代码也没有读取 OpenAI、豆包或其他模型厂商 Key 的环境变量；`coze-coding-dev-sdk` 的 `LLMClient` 依赖扣子运行环境注入访问能力。

## 首次设置

在 `projects/` 中执行：

```powershell
Copy-Item .env.example .env.local
pnpm install --frozen-lockfile
```

然后只在 `.env.local` 中填写实际 Supabase 配置。不得提交 `.env.local`、服务角色密钥或真实账号。

## 常用命令

```powershell
pnpm ts-check
pnpm lint:build
pnpm build
pnpm dev
```

- 默认开发端口为 `5000`。
- 外部托管环境通过 `DEPLOY_RUN_PORT` 指定端口，脚本会把它传给服务端的 `PORT`。
- Windows 本地若没有 Bash，可直接执行 `pnpm next build`；`dev/build/start` 包装脚本需要 Bash。

## pnpm 安装脚本策略

`projects/pnpm-workspace.yaml` 只允许运行当前构建所需的 `esbuild`、`sharp` 和 `unrs-resolver` 安装脚本；测试依赖 `msw` 的安装脚本暂不允许。新增需要安装脚本的依赖必须经过审查后显式加入。

## 已知限制

- 没有扣子运行身份时，AI 接口无法完成真实模型调用。
- 没有 Supabase 配置时，数据库接口不能完成端到端验证。
- 本地 Schema 与部分 API 引用的远程表仍不一致，详见 `DATABASE_MODEL.md` 和动态问题台账。

## 本期数据库迁移

项目一闭环依赖`drizzle/0001_game_runtime_state.sql`。只允许在非生产Supabase先应用并完成冒烟；迁移前备份，迁移后确认两张表启用RLS且没有public读写策略。应用迁移需要服务端私密服务角色Key，本地浏览器永远不得读取该Key。
