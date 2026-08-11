# 工作交接

## 当前交接点

外层项目 harness 和 Git 基线已建立。本期范围已批准。工作包 A 的本地安装、检查、构建和启动基线已通过；远程数据库核验与完整冒烟仍在动态台账中。下一步进入工作包 B。

## 下一位执行者先做什么

1. 阅读 `harness/STATE.md`。
2. 阅读 `issues/ISSUE_REGISTER.md`，确认开放、阻塞和延期项。
3. 从 `plans/CURRENT_ITERATION.md` 当前进行中的工作包继续。
4. 每批工作结束后更新问题台账、STATE、验证证据和交接。

## 注意

- 不要把外部 584MB 素材库整体复制进 Git。
- 不要把 Supabase 或模型密钥写入仓库。
- 当前 AI 对话前后端契约不一致，不能以页面存在推断功能可用。
- 缺少非生产Supabase访问，`BASE-003`保持阻塞，不得推断远程模型与本地Schema一致。
- `projects/pnpm-workspace.yaml`是安装脚本白名单，不要无审查扩大允许范围。
