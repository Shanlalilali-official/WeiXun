# 政企销售 AI 竞标实训游戏

面向政企和 B2B 销售的 AI 竞标实训平台。项目一通过客户对话、关系经营、竞品博弈和结算复盘训练销售过程。

## 分支说明

- **`main`** 是仓库默认分支。克隆后默认进入这条分支。
- **`handover/2026-11-02-preview`** 包含最新的项目一开场、客户活动语义识别和设计师提示词编辑。查看[交接分支的当前功能、入口和启动说明](https://github.com/Shanlalilali-official/WeiXun/blob/handover/2026-11-02-preview/README.md)。

## 交接资料

日常操作见[交接与操作手册](docs/handover/README.md)，数据迁移见[恢复手册](docs/handover/DATA_RESTORE.md)，2026-10-30 的交付范围见[交接核验记录](docs/handover/DELIVERY_REPORT.md)。

## Windows 一键启动

先在 `projects/` 配置 `.env.local` 并使用 pnpm 9.x 安装依赖，详见[应用配置说明](projects/README.md)。再双击项目根目录的 `start-project.bat`。脚本检查环境与构建产物，并打开浏览器。默认地址为 `http://127.0.0.1:5000/`。如果端口已被其他服务占用，以脚本输出的地址为准。

本目录是项目治理与版本管理根目录。现有 Next.js 工程保留在 `projects/`，外层 `harness/` 用于管理目标、项目上下文、长期记忆、迭代计划和开发循环。

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
