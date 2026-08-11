# 政企销售 AI 竞标实训游戏

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

