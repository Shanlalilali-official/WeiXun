# 工作交接

## 当前交接点

Windows 人工验收可直接双击仓库根目录 `start-project.bat`；服务以前台窗口运行，关闭窗口即停止。默认地址为 `http://127.0.0.1:5000/`。

项目已脱离 Coze 运行时。应用使用标准 Node/Next.js、通用 OpenAI 兼容 AI Provider 和托管 Supabase。项目一真实数据库、真实模型 E2E、浏览器关键路径和生产构建均已通过；剩余问题以 `harness/issues/ISSUE_REGISTER.md` 为准。

## 下一位执行者

1. 阅读 `harness/STATE.md` 和 `harness/issues/ISSUE_REGISTER.md`。
2. 双击 `start-project.bat` 启动人工验收环境；无需 Docker。
3. 开发前运行 `projects/scripts/check-local-env.ts` 对应的 `pnpm local:check`，不得输出或提交密钥。
4. 继续处理 AI-005、GAME-003、DB-002 等未解决项，并执行与风险相称的回归。
5. 更新所有问题状态与证据；不删除问题历史。

## 安全与约束

- 不提交 `.env.local`、模型 key 或 service_role key。
- 不把外部素材库整体复制进 Git。
- 不为测试放宽运行状态表的 RLS。
- DB-002 的多写入原子性仍未解决。
- C0 公式只能由业务负责人确认后修改。
