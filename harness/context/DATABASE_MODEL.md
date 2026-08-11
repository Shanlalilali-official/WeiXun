# 数据库模型盘点

## 本地 Drizzle 权威文件

当前本地模型位于 `projects/src/storage/database/shared/schema.ts`，共 14 张表：

| 领域 | 表 |
|---|---|
| 基础 | `health_check` |
| 用户与企业 | `enterprises`、`invite_codes`、`user_identities` |
| 内容配置 | `industries`、`product_categories`、`scenario_templates`、`decision_makers`、`project_scenarios`、`product_knowledge` |
| 对局 | `game_sessions`、`chat_messages`、`affinity_scores`、`player_ability` |

## API 引用但本地未建模的表

静态扫描确认以下 10 张表被 API 使用，但不在本地 Drizzle Schema 中：

| 表 | 使用区域 | 本期处理 |
|---|---|---|
| `game_groups` | 教练分组 | 延期后台能力 |
| `coach_history` | 教练历史 | 延期后台能力 |
| `game_initiations` | 教练/企业发起 | 延期后台能力 |
| `scenario_locks` | 教练/企业锁定场景 | 延期后台能力 |
| `game_rooms` | 教练房间 | 延期多人能力 |
| `enterprise_customizations` | 企业定制 | 延期后台能力 |
| `enterprise_history` | 企业历史 | 延期后台能力 |
| `competitor_profiles` | 竞品配置 | 项目一闭环需要核验 |
| `npc_profiles` | NPC 配置 | 项目一闭环需要核验 |
| `project_difficulties` | 项目难度 | 项目一闭环需要核验 |

## 当前结论

- 本地 14 表只能视为“仓库模型”，不能推断等于远程 Supabase 实际结构。
- 项目一将优先使用已有对局表，并为 NPC、竞品和难度建立明确的数据来源；不得继续无类型地假设远程表字段。
- 在获得可用的 Supabase 开发环境后，必须执行远程模型拉取/比对，再决定补表、迁移或移除失效 API。
- 后台和多人延期表继续记录，但不在本期为了“凑齐 Schema”而盲目创建。

## 远程核验门槛

需要非生产 Supabase URL、匿名 Key，以及执行模型同步所需的受控权限。服务角色 Key 只能放在本地私密环境，不得写入仓库、日志或客户端代码。
