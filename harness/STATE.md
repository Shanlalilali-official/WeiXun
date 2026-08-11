# 当前状态

- 阶段：本期实施
- 状态：范围已批准，按工作包 A → B → C/D → E 执行
- 当前目标：完成项目一可运行、可对话、可恢复、可结算的单人纵向闭环
- 实现授权：已开放，仅限 `CURRENT_ITERATION.md` 批准项
- 最近实现：`663d77f feat(game): add project one server-authoritative loop`
- 下一道门：取得非生产Supabase与扣子开发环境，应用迁移并执行完整纵向冒烟

## 当前已知事实

- 应用位于 `projects/`，技术栈为 Next.js 16、React 19、TypeScript、Supabase、Drizzle 和 `coze-coding-dev-sdk`。
- 依赖已安装；TypeScript、ESLint、Next.js 生产构建、服务端打包和HTTP启动探测通过。
- AI 凭证不在仓库中，现有实现依赖扣子运行环境。
- 原本地14张Drizzle表与API额外引用的10张远程表不一致；本期新增2张运行表的迁移尚未应用。
- 外部业务资料仍存在人物、轮次、评分和事件定义冲突。
- 项目一5轮状态机、动作、解锁、持久化、五维结算、上下文窗口与AI复盘代码已完成并通过本地静态/纯函数验证。
- NPC聊天和场景生成契约已统一，NPC画像改为服务端加载，AI状态输出增加确定性校验。
- 生产启动仍输出Node弃用警告；ESLint全量扫描约125秒，均已保留为开放问题。

## 动态问题入口

所有未解决、阻塞、延期和已解决问题统一记录在 `harness/issues/ISSUE_REGISTER.md`。任何工作批次结束时必须同步更新。

## 下一步

当前没有可继续安全完成的数据库/模型端到端步骤。取得非生产Supabase URL、匿名Key、服务角色Key和扣子模型身份后：应用迁移，执行项目一固定冒烟，修复暴露问题；C0公式另需业务负责人确认正确引用和权重。
