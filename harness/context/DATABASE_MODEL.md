# 数据库模型

`projects/src/storage/database/shared/schema.ts` 是当前 16 张已建模表的代码源；`projects/supabase/migrations/` 保存从该 schema 生成的完整初始迁移及后续主键/RLS 修正。

| 领域 | 表 |
|---|---|
| 基础 | `health_check` |
| 用户与企业 | `enterprises`, `invite_codes`, `user_identities` |
| 内容配置 | `industries`, `product_categories`, `scenario_templates`, `decision_makers`, `project_scenarios`, `product_knowledge` |
| 对局 | `game_sessions`, `chat_messages`, `affinity_scores`, `player_ability` |
| 权威运行状态 | `game_runtime_states`, `game_events` |

API 还引用 10 张未进入本地 schema 的历史/延期表：`game_groups`、`coach_history`、`game_initiations`、`scenario_locks`、`game_rooms`、`enterprise_customizations`、`enterprise_history`、`competitor_profiles`、`npc_profiles`、`project_difficulties`。这些引用不能视为已验证的数据模型，后续应按实际功能逐一建模或移除。

运行状态表启用 RLS 且不开放 public 读写，只允许服务端使用 `SUPABASE_SERVICE_ROLE_KEY`。现有旧表的宽松 public policy 是继承问题，正式发布前必须收紧（OPS-002）。

本地迁移尚未实际执行；启动 Supabase 后需要运行 `pnpm supabase:reset`，再完成项目一完整纵向冒烟与故障恢复验证。
