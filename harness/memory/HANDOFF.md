# 工作交接

## 当前交接点

项目已脱离 Coze 运行时。应用使用标准 Node/Next.js 启动、通用 OpenAI 兼容 AI Provider，以及仓库内的本地 Supabase 配置。项目一业务代码已完成本地静态/纯函数验证；数据库和真实模型的完整纵向冒烟仍受外部环境阻塞。

## 下一位执行者

1. 阅读 `harness/STATE.md` 和 `harness/issues/ISSUE_REGISTER.md`。
2. 在 `projects/` 安装并启动 Docker Desktop、Supabase CLI，执行 `./scripts/setup-local.ps1`。
3. 将 Supabase 本地输出和用户提供的模型配置写入 `.env.local`，运行 `pnpm local:check`。
4. 执行 `pnpm supabase:reset` 和 `harness/plans/SMOKE_TEST_PROJECT_1.md`。
5. 更新所有 Blocked 项；不删除问题历史。

## 安全与约束

- 不提交 `.env.local`、模型 key 或 service_role key。
- 不把外部素材库整体复制进 Git。
- 不为测试放宽运行状态表的 RLS。
- DB-002 的多写入原子性仍未解决。
- C0 公式只能由业务负责人确认后修改。
