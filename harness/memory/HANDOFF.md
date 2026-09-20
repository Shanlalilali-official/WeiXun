# 工作交接

## 2026-09-20 五人人物完整提示词

- 完整提示词源位于 `projects/src/lib/designer/npc-role-prompts.ts`，默认配置直接引用该映射；审阅版位于 `outputs/五人人物提示词完整稿-2026-09-20.md`。
- 当前开发库已应用 `20260920000100_replace_project_one_npc_role_prompts.sql`，读取为 revision 2 且五项与代码一致。迁移仅合并人物总提示词，其他提示词配置保留。
- 专项命令为 `corepack pnpm test:npc-role-prompts`；另需保持 `test:prompt-excel`、TypeScript、目标 ESLint 和生产构建通过。后续设计师仍可在页面修改并保存这些提示词。

## 2026-09-20 素材库合并与高清预览

- `/designer` 现在只有素材库、数据、报告、测试四个一级入口。拜访场景图片已并入素材库；旧“场景提示词”只读界面已删除，人物提示词仍从素材库进入 `/designer/prompt-library`。
- 人物介绍图、已有表情图和已有场景图均可点击打开高清预览；支持关闭按钮、点击遮罩和 Escape。空槽位仍直接显示上传入口。专项为 `test:designer-image-assets`。

## 2026-09-17 跳过准备直接拜访

- 五人预览准备页现在可直接开始实际拜访。前端 `skip-visit-prep` 调用 `startVisitSimulation({skipPreparation:true})`；服务端 `start_visit` 仅在此布尔参数明确为 true 时放宽准备前置条件。普通实际模拟仍需已批准准备，简述方案流程不变；不记录假的准备文本。回归见 `test:project-one-preview-ai` 和 `test:preview-test-controls`。

## 2026-09-17 预约调节与素材上传

- 五人预览顶部“测试调节”可编辑每人的拜访预约。操作经 `test_adjust_appointments` 或与 NPC 数值合并的测试请求写入服务端进程内预览会话，刷新后按服务端返回列表同步；仍不属于正式存档。预约状态会在 AI 接受邀约和拜访结束时更新。检查 `test:preview-test-controls` 与 `test:project-one-preview-ai`。
- `/designer` 的素材库和场景页可上传图片。`GET /api/designer/image-assets` 列出 34 个槽位；`POST` 仅设计师可写，文件进入 `designer-image-assets` Storage bucket，元数据进入 `designer_image_assets`。当前开发库已应用 `20260917000100_designer_image_assets.sql`。五张现有人物介绍图保留；五人各五种表情和四个拜访场景仍为空，等待用户上传。预览页按槽位读取介绍图和匹配的拜访场景图。检查 `test:designer-image-assets`。
- 上传服务依赖当前环境的 Supabase URL 与 service role 配置；迁移已在当前开发库落地。换环境部署时需同步迁移，不能只复制前端文件。保留本批之前未提交的预览流式输出、微信表情相关改动，未自动提交。

## 2026-09-16 人物提示词表格

- 新导出工作簿以中文人物姓名、提示词用途和交流方式填写；旧版“人物 ID/范围/渠道 ID/提示词”格式仍能导入。页面说明已读不回角色偏好可写入人物总提示词或邮件/工作微信补充，系统沉默协议保持固定。检查 `projects/scripts/test-prompt-excel.ts`、TypeScript、ESLint 与生产构建后再交付。

## 2026-09-15 人物提示词 Excel

- `/designer/prompt-library` 新增导出/导入按钮；`/api/designer/prompt-excel` 只允许设计师，GET 导出服务端保存版本，POST 校验并返回待应用的人物提示词，不写库。导入后须点击“应用到页面草稿”及“保存全部”。专项脚本为 `projects/scripts/test-prompt-excel.ts`。
- 当前机器 PATH 的 pnpm 11 不符合项目 pnpm 9 engine；已通过已安装的 `node_modules/.bin` 执行专项、TypeScript、ESLint 和生产构建。保留原有未提交改动，不自动提交。

## 2026-09-15 已读不回交接

- 用户批准方案已实现于五人预览；见 projects/docs/NPC_READ_NO_REPLY.md。保留任务开始前所有未提交改动，未提交或推送。
- 已完成本地浏览器 mock 验收：微信/表情包/邮件沉默、附件独立、扣点、刷新、失败重试。用于验收的 localhost mock 和开发服务器已停止。
- 真实模型脚本：在 projects 目录执行 corepack pnpm test:npc-silence-live，输出 outputs/npc-silence-live.json。此前60轮网络失败；自动审批要求明确授权向 api.deepseek.com 发送 NPC 上下文、测试消息与附件后才能重跑。不要将当前失败报告视为成功证据。

## 当前交接点

2026-09-11：项目一五人版工作微信已加入常用 Emoji 与 8 个系统预设工作表情包，不提供上传。实现集中在 `projects/public/project1-prototype-v9.html`；表情包以 `[表情包：名称]` 走现有 AI `message` 契约，成功后才扣 1 行动点，并在本地消息保存 `messageType:'sticker'` 与白名单 `stickerId`。专项脚本为 `projects/scripts/test-wechat-expressions.ts`，命令 `corepack pnpm test:wechat-expressions`。旧 `/game` 未改。

同日新增顶部“测试调节”，可修改阶段、行动点、累计消耗与五人微信状态；已添加微信后可直接测试消息、Emoji 和表情包。面板还可调整每位 NPC 的支持度、愉悦度和有效接触次数，并通过测试专用 `test_adjust_npcs` action 同步到当前进程内预览会话；派生节点只读返回，工作记忆、维度评分与合规阻断不开放修改。生产环境默认拒绝该 action，正式数据库不受影响。专项命令为 `corepack pnpm test:preview-test-controls` 与 `corepack pnpm test:project-one-preview-ai`；不要把该入口迁入正式 `/game`。

2026-09-08：本批现有功能缺陷修复已完成主线程验证，详情见STATE本日增量与动态台账。保留本轮前未提交的设计师页面/主档/提示词改动；本轮没有自动提交或推送。下方旧日期内容为历史记录，不覆盖本日状态。

开发库已应用 `20260904000100_fix_game_completion_timestamp.sql` 与 `20260908000100_fix_command_conflict_sqlstate.sql`。后者保持两个RPC签名、权限与事务，业务冲突改为P0001并保持首次完成时间。不要改回40001：会被接口重试至60秒中止。`corepack pnpm test:completion-timestamp-e2e` 创建并清理独立对局，覆盖时间稳定、幂等、冲突及时返回及版本/命令记录回滚。

日常使用 `corepack pnpm local:check:prompt-test`、`test:local-env`、`test:prompt-test`、`test:prompt-test-auth`、`test:prompt-test-ui`、`test:project-one-preview-ai`；增量用 `lint:cached`，发布保留 `lint:build`。PATH的pnpm11不是项目声明版本；启动脚本优先本地二进制，首次安装仍需缓存或网络。

C0采用用户授权的新正向规则（D-052增量），不是恢复原稿。五人合规解除只核验本轮训练表达，不证明现实整改已完成。进程内会话、首次响应丢失但尚无sessionId时的恢复、完整真实双模型/PDF/多尺寸验收仍由STATE-002与TEST-003跟踪，不能在本轮标成正式持久化对局。

2026-09-07 Windows 一键启动的生产构建已恢复并完成真实启动冒烟，`/api/health/startup` 返回应用标识、当前 buildId 与 `database: ok`。React Dev Inspector 与全局 `.babelrc` 已移除，Next.js 使用默认编译链；评分证据复核位于 `src/lib/ai/npc-evaluation-sources.ts`，该纯模块不能重新引入 AI client、Node 内置模块或其他服务端运行时依赖，否则 `/game` 客户端构建会再次失败。项目依赖应通过 packageManager 指定的 pnpm 9 安装。

2026-09-07 游戏设计师首页 `/designer` 已改为五个任务型一级入口：素材库、数据、场景、报告、测试。现有人物资料、评估提示词、模型测试、项目数据、竞品、指标和五人实际测试均保留可达；人物图片、报告集合和上传能力没有后端模型时只显示空状态。后续接入报告或素材存储时应在对应工作区补真实数据，不恢复旧的甲方/乙方一级平铺结构。

2026-08-26 五人版前端已接入现有系统并完成真实 AI 预览接线。`projects/public/project1-prototype-v9.html` 保持目标原型视觉，`projects/src/app/project-one-preview/page.tsx` 全屏承载；项目一单机入口指向该页，多人与原 `/game` 未改。总体/人物计划、邮件/电话/微信、拜访准备、实际拜访和简述方案调用鉴权的 `/api/project-one-preview/ai`，不再执行固定 NPC 话术。

浏览器已验证原型项目入口、项目一详情、五人层级和项目背景/人物结构/总体计划三栏；契约测试、TypeScript、目标 ESLint、既有回归与 Next.js 生产构建通过。真实 Provider 已返回计划判断和动态项目经理邮件。人工测试可双击 `start-project.bat`，在项目地图选择“单单位内部竞标”→“单机 · 五人前端测试版”，或直接访问启动器实际端口下的 `/project-one-preview`。

`D:\WeiXun\Weixun Web\project1-prototype-v9.html` 仍作为项目一前端目标主参考，但运行资产已加入真实 AI 适配，因此不再与源 HTML 字节一致。后续开发应先读 `harness/context/FRONTEND_TARGET_WEIXUN_WEB.md`、D-039～D-042、FRONT-001～FRONT-003。

下一版固定采用五人结构，但人物信息表当前只读取“人物主档”，主档内容仍可调整，其他工作表暂不管。公开信息持续沉淀并更新前端；总体工作计划与拜访准备分别由独立 AI 判断，隐藏信息只从人物主档匹配；附件由 AI 判断具体影响并进入 NPC 记忆，NPC 可选择不看，未查看时不能知道附件正文。当前没有已确认的下一版服务端规则，代码/旧台账差异按未来实现契约处理。

2026-08-20 项目一已按最新台账与 D-035/D-036 切换为五阶段纯行动点主流程：公开信息搜索可重复付费且不沉淀联系人卡片；新准备统一为自由文本并执行确定性五要素语义校验；电话、邮件和微信保留，普通邮件支持附件；竞品隐藏分、主张和阶段动作在全过程及结算均不下发玩家。

D-037 进一步收敛交互：联系人卡片与主沟通区删除独立“邀约见面”入口；电话、邮件和已申请工作微信后的自然语言消息继续走统一邀约判定，微信申请仍使用 `request_wechat`。

2026-08-20 远端验收已收口：GitHub `origin/main` 已同步本批次代码提交 `d1098de`；`20260819000200_five_stage_multiplayer.sql` 已应用到托管 Supabase 开发库，`supabase migration list` 对齐且远程 `db lint` 为 0 error。双账号 multiplayer E2E、single-save E2E、项目一真实 E2E、build、typecheck、全量 lint 和状态机测试均通过。移除独立“邀约见面/拜访准备”并保留微信的实现与台账分别落在 `149af4d`、`45a335d`。

GAME-013、AI-005、AI-010、AI-016、AI-017 已关闭：服务端概率种子、长对话摘要、两阶段 NPC 转述、评分协议和不可信数据隔离均通过真实或专项回归。FLOW-001、OBS-001 同时关闭，唯一存档已有数据库事务/约束，关键流程已有结构化观察事件。

Windows 人工验收可直接双击仓库根目录 `start-project.bat`；服务以前台窗口运行，关闭窗口即停止。默认尝试 `http://127.0.0.1:5000/`，若被旧服务占用会自动使用后续空闲端口并打开实际地址。

项目已脱离 Coze 运行时。应用使用标准 Node/Next.js、通用 OpenAI 兼容 AI Provider 和托管 Supabase。项目一现为五个行动点阶段，玩家端主流程使用电话、邮件和微信自然语言沟通；服务端旧 `online` 字段仅用于历史存档兼容。

当前应用实现不再存在隐藏人物解锁：四名 NPC 从开局全部显示，`key_contact` 仅作为旧档兼容线索；这是当前实现事实。下一版改为五人结构，迁移时仍不得把人物显示重新绑定到旧解锁逻辑。

2026-08-14 全量审计发现的 P0 安全/协议项 GOV-003、AUTH-002、GAME-013、AI-016、AI-017 均已关闭；AI-005 长对话摘要和 AI-010 跨人物转述也已通过回归。

## 下一位执行者

1. 阅读 `harness/STATE.md`、`harness/context/FRONTEND_TARGET_WEIXUN_WEB.md` 和 `harness/issues/ISSUE_REGISTER.md`。
2. 双击 `start-project.bat` 启动人工验收环境；无需 Docker。启动器会检查数据库、自动重建陈旧产物，并通过构建号健康检查避免复用旧服务（ENV-006 已解决）。
3. 开发前运行 `projects/scripts/check-local-env.ts` 对应的 `pnpm local:check`，不得输出或提交密钥。
4. FRONT-002/003 已完成。五人真实 AI 预览使用进程内会话，不写 Supabase；下一批正式业务同步应按 D-039～D-042迁移五人状态、公开信息和附件记忆到共享存储，并补齐多实例互斥/限流，不能把进程内预览态当正式存档。旧工程待办仍包括 MULTI-002/004、AI-019、DATA-001 和 UX-005。
5. FLOW-003~005、UX-006、MULTI-001、MULTI-003 与 TEST-002 已于 2026-08-20 关闭：公开搜索、自由文本准备、电话、邮件附件、微信入口、自然语言邀约、多人房间原子推进和双账号联机闭环均按当时台账实现并通过验收；这些是当前实现事实，不再被误写成下一版目标。
6. 更新所有问题状态与证据；不删除问题历史。

## 2026-08-31 提示词测试台交接

- 入口：`/designer/dialogue-prompts`；API：`/api/designer/prompt-test`。
- 页面当前固定张建国 `P1-001` 和 `in_person`，DeepSeek/豆包各自维护 sessionId、version、history、runtime 与完整逐轮 records；可同时运行双轨，也可单独运行/重置任一模型。
- 页面展示与模型上下文共用同一份张建国前情预设；提供 6 套 3–4 轮连续剧本。导出入口固定为“纯对话 PDF”和“对话+状态 PDF”，通过专用 A4 打印视图调用浏览器打印，需选择“另存为 PDF”。最近可导出快照保存在浏览器 localStorage，刷新后仍可查看；服务端 session 过期时需重置对应模型。
- 两个 Provider 的阻断和已验收线索区始终显示；本轮模型候选但未被 Resolver 接受的线索另列为“候选线索（未验收）”，不得当作正式状态或写入 PDF 正式线索。
- 环境变量见 `projects/.env.example` 和 `projects/docs/AI_PROVIDER_PRESETS.md`。真实 Key 只写 `.env.local`，修改后重启。
- 验证：`test-prompt-test.ts`、TypeScript、目标 ESLint、Next production build 已通过；真实豆包调用尚未执行。

## 安全与约束

- 不提交 `.env.local`、模型 key 或 service_role key。
- 不把外部素材库整体复制进 Git。
- 不为测试放宽运行状态表的 RLS。
- 聊天正文、评分、记忆、资源、事件与命令幂等已由 `commit_game_command` 原子提交；不要恢复旧的多次写入路径。
- 会话 token 已改 HMAC-SHA256 签名；不要恢复无签名 base64 兜底或 select_role 无凭证签发。
- C0 公式只能由业务负责人确认后修改。
