# 政企销售 AI 竞标实训游戏

面向政企和 B2B 销售的 AI 竞标实训平台。项目一提供五位客户角色，玩家通过联系客户、准备拜访、策划活动、收集证据和应对竞品完成对局，并查看结算复盘。

## 当前分支

本页对应 `handover/2026-11-02-preview`，包含最新一批项目一改动。

- **项目一**（`/game`）和**实际测试**（`/project-one-preview`）使用同一开场流程。行业和主营业务可分别选择预设或自行填写。自定义方向会随对局保存，并使用通用练习简报。按自定义方向即时生成完整项目资料仍在计划中。
- **客户活动**由大模型根据对话识别真实提议。达到开展门槛后进入策划，未达门槛时提示客户暂时无法开展。
- **设计师工作台**（`/designer`）可以查看和编辑运行时业务规则（`/designer/runtime-prompts`）、结构化决策（`/designer/jev-config`）以及人物和渠道提示词（`/designer/prompt-library`）。人物提示词页可一并编辑该人物的电话接听和邮件回复决策。客户活动的开展条件与方案评价在活动专项设置（`/designer/customer-activities`）维护。

## Windows 一键启动

先按[应用配置与验证说明](projects/README.md)准备 Node.js、pnpm 9.x、Supabase 和模型服务，再双击项目根目录的 `start-project.bat`。脚本检查数据库和构建产物，需要时重新构建，并打开浏览器。默认地址为 `http://127.0.0.1:5000/`。如果端口已被其他服务占用，以脚本输出的地址为准。

## 交接资料

日常操作与历史交接记录见[交接与操作手册](docs/handover/README.md)。数据库和素材恢复见[恢复手册](docs/handover/DATA_RESTORE.md)，2026-10-30 的交付核验见[交接核验记录](docs/handover/DELIVERY_REPORT.md)。本分支当前实现与验证范围见[项目状态](harness/STATE.md)。

## 入口

接手项目或开始一次新工作前，按顺序阅读：

1. `PROJECT.md`
2. `harness/STATE.md`
3. `harness/plans/CURRENT_ITERATION.md`
4. `harness/memory/DECISIONS.md`
5. `harness/context/PROJECT_CONTEXT.md`

## 目录

```text
project_20260811_095926/
├── AGENTS.md                    # Agent/开发协作规则
├── PROJECT.md                   # 项目章程与目标边界
├── harness/
│   ├── STATE.md                 # 当前状态和下一道门
│   ├── context/                 # 稳定项目上下文
│   ├── memory/                  # 决策、发现与交接记忆
│   ├── plans/                   # 当前迭代与候选 backlog
│   └── loops/                   # 开发和验证循环
├── scripts/harness-check.ps1    # 治理结构检查
└── projects/                    # 现有 Next.js 工程
```

业务素材原件位于外部目录 `D:\WeiXun\竞标游戏项目相关\整理`，不复制进当前 Git 仓库。采用哪个版本由 `harness/context/SOURCE_OF_TRUTH.md` 记录。
