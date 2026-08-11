# AGENTS.md — 政企销售竞标博弈 AI 培训游戏

## 1. 项目概览
- **类型**：B2B 政企销售实训（Coze 低代码 + Next.js）
- **目标**：通过 AI 模拟政企客户、竞品、复盘，让学员在 8 类典型政企项目（智慧政务/医联体/教育云/交通/公安/民政等）实战博弈演练
- **核心角色**：4 身份权限（平台设计师/企业管理员/培训教练/玩家），玩家细分企业员工 vs 付费个人
- **核心玩法**：单人对局 + 多人联机（教练管控）

## 2. 技术栈
- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + Design Tokens（见 `src/app/globals.css` `@theme` 块）
- **UI 组件**: shadcn/ui (`src/components/ui/`)
- **Icons**: lucide-react（**禁止用 emoji 当图标**）
- **DB**: Supabase + Drizzle ORM
- **LLM**: coze-coding-dev-sdk（默认 `doubao-seed-2-0-lite-260215`，**SSE 流式输出**）
- **字体**: Inter（中文 Noto Sans SC fallback）

## 3. 目录结构
```
src/
├── app/                      # Next.js 路由（页面）
│   ├── (auth)/login/         # 登录 + 身份选择
│   ├── home/                 # 实训工作台
│   ├── start/                # 关卡选择（等距图选位置）
│   ├── game/                 # 博弈演练主页面
│   ├── setup/                # 对局配置（含 AI 场景生成）
│   ├── result/               # 结算复盘
│   ├── knowledge/            # 知识库管理
│   ├── ranking/              # 排行榜
│   ├── room/                 # 多人联机房间
│   └── api/                  # 后端 API Routes
│       ├── auth/             # 登录/身份/登出
│       ├── chat/             # LLM 流式对话（SSE）
│       ├── scenario/         # AI 场景生成
│       ├── ranking/          # 排行榜查询
│       └── ...               # 其他 API
├── components/
│   ├── ui/                   # shadcn 基础组件
│   ├── layout/               # 顶部状态条/侧边栏/状态徽标
│   ├── hotspot/              # 等距图 hotspot
│   └── charts/               # 雷达图/折线图
├── storage/database/
│   ├── shared/schema.ts      # Drizzle Schema（14 张表）
│   ├── supabase-client.ts    # 客户端单例
│   └── *.ts                  # 业务 CRUD
├── lib/
│   ├── ai/                   # LLM 调用封装（**必须 SSE**）
│   │   ├── client.ts
│   │   ├── prompts/          # 5 套提示词
│   │   └── workflows/        # 3 条工作流
│   ├── auth/                 # 登录态/角色守卫
│   └── utils.ts
├── types/                    # TS 类型定义
└── ...
```

## 4. 数据表（14 张）
| # | 表名 | 用途 |
|---|------|------|
| 1 | industries | 5 行业（政府/事业单位/制造/央企/民企） |
| 2 | product_categories | 产品分类 |
| 3 | scenario_templates | 标准场景案例（预制多套） |
| 4 | enterprises | 企业信息 |
| 5 | invite_codes | 邀请码（企业员工绑定） |
| 6 | user_identities | 用户身份（4 角色 + 二级） |
| 7 | decision_makers | 决策人（AI 模拟） |
| 8 | project_scenarios | 项目场景 |
| 9 | game_sessions | 对局会话 |
| 10 | affinity_scores | 亲密度评分 |
| 11 | product_knowledge | 产品知识库 |
| 12 | chat_messages | 对话消息 |
| 13 | player_ability | 玩家能力值 |
| 14 | health_check | 健康检查 |

## 5. 关键约束
- **AI Streaming First**: LLM 调用必须用 SSE（`ReadableStream`）流式输出，前端用 `fetch + getReader` 增量渲染
- **前后端分离**: API 用 Next.js API Routes（`src/app/api/**/route.ts`），前后端通过 HTTP/JSON 通信
- **身份权限**: 4 身份严格隔离，前端隐藏越权入口 + 后端 API 校验 `x-session` header
- **多 worktree**: 端口来自 `DEPLOY_RUN_PORT`，主仓固定 5000
- **图标**: 全部用 lucide-react（`Shield`/`UserCog`/`Megaphone`/`UserRound`），不用 emoji
- **禁止 Mock**: 严禁伪造 LLM 响应/数据返回，必须真实调用

## 6. 开发命令
```bash
pnpm install         # 装依赖
pnpm dev             # 启动开发（5000 端口）
pnpm build           # 构建生产
coze-coding-ai db generate-models  # 拉取远端 schema
coze-coding-ai db upgrade          # 推送 schema 变更
```

## 7. 常见问题
- **图片资源**: 放在 `public/`，`game-park.*`（首页等距图）+ `game-map.*`（关卡选择图）
- **新页面**: 在 `src/app/<page>/page.tsx` 创建，路由 `/<page>`
- **新 API**: 在 `src/app/api/<name>/route.ts` 创建，导出 `GET/POST/PUT/DELETE` 函数
- **LLM 提示词**: 新增放 `src/lib/ai/prompts/<name>.ts`，导出 `systemPrompt: string` 常量

## 8. 落地约束
- UI 素材以人工上传为准，**AI 不自动生成页面图片**
- 批量导出/复杂统计功能**预留 API 接口**，本期不实现
- 多人房间实时通信本期**预留 WebSocket 接口**，后续实现
