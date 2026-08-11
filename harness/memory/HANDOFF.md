# 工作交接

## 当前交接点

工作包A/B已完成并提交。C/D/E的项目一代码已完成本地实现：5轮状态机、稳定NPC、服务端动作、事件/消息持久化、滚动摘要、五维结算和AI复盘。生产构建与纯函数测试通过，但远程迁移和真实模型/数据库纵向冒烟被凭证阻塞。

当前实现提交：`663d77f feat(game): add project one server-authoritative loop`。

## 下一位执行者先做什么

1. 阅读 `harness/STATE.md`。
2. 阅读 `issues/ISSUE_REGISTER.md`，确认开放、阻塞和延期项。
3. 取得非生产凭证后应用`projects/drizzle/0001_game_runtime_state.sql`。
4. 按`plans/SMOKE_TEST_PROJECT_1.md`执行完整纵向冒烟。
5. 每批工作结束后更新问题台账、STATE、验证证据和交接。

## 注意

- 不要把外部 584MB 素材库整体复制进 Git。
- 不要把 Supabase 或模型密钥写入仓库。
- 当前浏览器仍回传全部历史，且所有NPC共享一份前端消息；不要把工作包B的契约完成误认为上下文持久化完成。
- 缺少非生产Supabase访问，`BASE-003`保持阻塞，不得推断远程模型与本地Schema一致。
- `projects/pnpm-workspace.yaml`是安装脚本白名单，不要无审查扩大允许范围。
- 新运行表启用RLS且没有public策略，服务端需要服务角色Key；不得为了测试改成公开读写。
- 消息、状态和事件当前是多次写入，`DB-002`要求后续用事务/RPC解决原子性。
- `C0`不可凭猜测修正；需要公式负责人确认`A314`的真实引用和完整权重。
