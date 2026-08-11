# 项目协作规则

本文件适用于整个项目根目录。`projects/AGENTS.md` 中的工程约束继续适用于应用目录；若两者冲突，以本文件的治理与范围规则优先，以内层文件的技术实现约束补充。

## 开始工作

每次开始前必须阅读：

1. `PROJECT.md`
2. `harness/STATE.md`
3. `harness/plans/CURRENT_ITERATION.md`
4. `harness/issues/ISSUE_REGISTER.md`
5. `harness/memory/DECISIONS.md`
6. 与任务有关的 `harness/context/` 文档

## 范围门

- `CURRENT_ITERATION.md` 中只有标记为“已批准”的条目可以进入实现。
- 发现新问题时先写入 `BACKLOG.md` 或 `FINDINGS.md`，不要自动扩大范围。
- 所有确认的问题必须进入 `ISSUE_REGISTER.md`。问题只改变状态，不删除；未解决问题必须保留原因和下一步。
- 业务资料冲突时停止依赖该规则进行实现，并在 `DECISIONS.md` 新增待决项。

## 实现要求

- 一个工作项对应一个可验证的用户或系统能力。
- 修改前记录当前行为、目标行为、影响范围和验收条件。
- 优先修复端到端契约，避免只做页面表象。
- AI 输出影响游戏状态时必须使用结构化契约，并由确定性代码校验。
- NPC 对话、轮次、线索、分数等状态必须以服务端会话为权威来源。
- 不提交密钥、真实账号、`.env` 或临时调试输出。

## 结束工作

每批有意义的修改必须：

1. 执行与风险相称的验证。
2. 更新 `harness/STATE.md`。
3. 把新决定写入 `DECISIONS.md`，把新发现写入 `FINDINGS.md`。
4. 更新当前迭代条目状态和证据。
5. 更新 `ISSUE_REGISTER.md` 的状态、证据、阻塞原因和最后检查日期。
6. 在 `HANDOFF.md` 留下可由下一位开发者直接继续的信息。

## Git

- 提交应聚焦一个工作项，使用 `type(scope): summary` 格式。
- 推荐类型：`chore`、`docs`、`fix`、`feat`、`refactor`、`test`。
- 不重写他人历史，不使用破坏性重置。
- 范围确认前只允许治理、文档、诊断和基线提交。
