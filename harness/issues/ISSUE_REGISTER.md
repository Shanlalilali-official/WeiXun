# 动态问题台账

- 最后全面检查：2026-08-11
- 规则：问题只改变状态，不删除；解决必须记录证据。

## 本期问题

| ID | 优先级 | 状态 | 问题/目标 | 当前原因或下一步 |
|---|---|---|---|---|
| BASE-003 | P0 | Blocked | 本地 schema 与 API 实际用表不一致 | 已生成 16 表完整迁移；仍有 10 张历史 API 引用表未建模，需逐功能核验 |
| BASE-004 | P0 | Blocked | 缺少完整固定纵向冒烟 | 数据库与真实模型已就绪；下一步立即执行项目一纵向冒烟 |
| BASE-006 | P2 | Open | ESLint 全量扫描慢 | 分析扫描范围并建立增量策略 |
| BASE-007 | P2 | Open | 全量 ESLint 存在 37 个历史错误 | 集中在延期后台/排行页面的 `any` 与未转义引号；本次改动文件 lint 已通过 |
| AI-003 | P0 | Blocked | NPC 记忆持久化与刷新恢复 | 代码已实现且数据库就绪；待纵向恢复冒烟 |
| AI-005 | P1 | Blocked | 摘要和 Token 控制未真实验证 | 最近 12 条、滚动摘要和输出上限已实现；待长对话冒烟 |
| AI-007 | P0 | Blocked | 真实模型结构化尾部协议稳定性未知 | 真实模型最小调用已通过；仍需 NPC/场景结构化固定冒烟 |
| DB-001 | P0 | Resolved | 完整迁移已推送到托管开发数据库 | `health_check` 只读查询成功并读到 seed 数据 |
| DB-002 | P1 | Open | 消息、状态、事件多次写入缺少事务原子性 | 设计 PostgreSQL RPC/事务边界与幂等重试 |
| GAME-001 | P0 | Blocked | 五轮状态机未做 DB 纵向验证 | 纯函数/API 已实现并测试；等待 DB 冒烟 |
| GAME-002 | P0 | Blocked | 关系动作服务端扣点未做 DB 纵向验证 | 服务端路径和纯函数测试通过；等待 DB 冒烟 |
| GAME-003 | P0 | Blocked | NPC、软肋、线索解锁未做 DB 纵向验证 | 初始最小披露和服务端解锁已实现；等待 DB 冒烟 |
| GAME-006 | P0 | Blocked | 对局、动作、消息、结果恢复未完整验证 | schema、仓储、事件日志已实现；等待迁移和失败恢复验证 |
| GAME-007 | P0 | Blocked | 结算/诊断真实联调未完成 | 确定性五维结果与 AI 复盘已实现；等待 DB/模型纵向冒烟 |
| SCORE-002 | P1 | Blocked | C0 中 A314 引用与括号权重疑似错误 | 检测测试已确认；业务含义需公式负责人确认 |
| ENV-002 | P1 | Resolved | 已采用无需 Docker 的托管 Supabase 流程 | CLI 已安装、项目已关联、迁移已推送且远程查询成功 |

## 已知延期

| ID | 优先级 | 状态 | 问题 | 重新进入条件 |
|---|---|---|---|---|
| GAME-004 | P1 | Deferred | 四项目事件和竞品动态不完整 | 项目一闭环稳定后 |
| CONTENT-002 | P1 | Deferred | 完整关卡事件表命名体系未映射 | 项目一稳定 ID 完成后 |
| CONTENT-003 | P2 | Deferred | 素材用途、版本、版权未整理 | 功能闭环后建立资产目录 |
| ADMIN-001 | P1 | Deferred | 企业报告和邀请码 API 缺失 | 项目一闭环后进入后台阶段 |
| ADMIN-002 | P1 | Deferred | 设计师 CRUD 与权限不完整 | 数据模型稳定后 |
| ADMIN-003 | P1 | Deferred | 教练发起、观察、点评、历史不完整 | 单人状态机稳定后 |
| AUTH-001 | P1 | Deferred | 登录、验证码、Token 为演示实现 | 正式上线阶段；当前不可视为安全 |
| MULTI-001 | P2 | Deferred | 多人房间服务端状态与实时通信未实现 | 单人状态机稳定后设计协议 |
| MULTI-002 | P2 | Deferred | 断线恢复、教练广播、强制结束未实现 | MULTI-001 完成后 |
| OPS-001 | P2 | Deferred | 日志、监控、AI 失败与成本统计缺失 | 部署准备阶段 |
| OPS-002 | P2 | Deferred | RLS、备份、敏感数据、发布检查不完整 | 正式上线阶段 |
| TEST-001 | P1 | Deferred | 缺少完整 API/状态机/E2E 套件 | 本期先覆盖修改模块，后续体系化扩展 |
| AI-008 | P1 | Deferred | AI 自定义场景不能保存并进入状态机 | 本期只开放项目一 |

## 已解决

| ID | 状态 | 结果与证据 | 日期 |
|---|---|---|---|
| GOV-001 | Resolved | 建立外层 harness 与 Git 基线；harness-check 通过 | 2026-08-11 |
| GOV-002 | Resolved | 治理检查允许 `.env.example`，真实 `.env*` 仍禁止 | 2026-08-11 |
| BASE-001 | Resolved | 依赖、类型、lint、构建、服务启动基线通过 | 2026-08-11 |
| BASE-002 | Resolved | 建立无密钥环境模板与本地运行说明 | 2026-08-11 |
| BASE-005 | Resolved | 标准 Node/Next server 替换旧启动器，移除 `url.parse()`/乱码路径来源 | 2026-08-11 |
| AI-001 | Resolved | 游戏页与聊天 API 统一请求和 SSE 契约 | 2026-08-11 |
| AI-002 | Resolved | 服务端按对局/NPC 加载画像与上下文 | 2026-08-11 |
| AI-004 | Resolved | 正文与结构化状态分离并经 Zod 校验 | 2026-08-11 |
| AI-006 | Resolved | 场景生成前后端契约、鉴权和 JSON 校验统一 | 2026-08-11 |
| GAME-005 | Resolved | 项目一采用确定性中标/落标判定 | 2026-08-11 |
| CONTENT-001 | Resolved | 项目一人物表与稳定 ID 统一 | 2026-08-11 |
| SCORE-001 | Resolved | 用户侧统一五维评分并由服务端状态驱动 | 2026-08-11 |
| ENV-001 | Resolved | 移除 Coze SDK、运行命令、环境变量与启动器依赖；改用通用 AI Provider | 2026-08-11 |
| ENV-003 | Resolved | `setup-local.ps1` 的 UTF-8 中文字符串在 Windows PowerShell 5 下解析失败；已改为纯 ASCII，并支持无 Docker 的托管流程 | 2026-08-11 |
| ENV-004 | Resolved | 环境检查原先只判断非空，不能识别错误 URL；现已校验 HTTP/HTTPS 完整 URL | 2026-08-11 |
