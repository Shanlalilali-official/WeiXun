# 工作交接

## 2026-10-12 高层/低接受度短回复（本地完成，外部抽样待授权）

- 修改npc-role-prompts.ts五人low例句与长度参考、customer.ts允许更短/遵循角色档位；张low10-30最多40，其他low20-45最多60，中高上限张60/80其他80/100。张普通忙碌收束与条件会议示例分开，敏感明确拒绝、告辞不追加；评估/需完整邮件不受日常限制。base/阈值/评分/会面结束未改。
- scripts/fixtures/npc-role-prompts-2026-10-12-before-short-replies.json及prompt-config全四字段指纹精确升级，任意自定义保留。主线程五专项、锁定pnpm ts-check/lint:build、Next/tsup build通过；v4稿已导出。核实旧3000 Next进程56240后刷新为36764，HTTP200及prompt-config revision5五人新版规则加载，Provider deepseek revision5保持，runtime证据独立目录未覆盖旧45场。
- 提示词抽样worker仅生成27条沙箱网络失败原始证据，无真实正文。联网升级被auto-review明确拒绝（新版内部提示词和上下文向三个外部目的地缺明确授权），不得换UI/接口绕过；待用户明确同意发送内容到配置的DeepSeek/豆包/Qwen服务后再测试。不得声称新稿已在真实模型达标；旧45场/PDF保持原时点，PROMPT-007/009/010、TEST-VISIT-001未关闭。新增PROMPT-011本地Resolved、TEST-SHORT-001 Open。

## 2026-10-12 三模型真实拜访复验（矩阵、截图与PDF完成）

- 已完成deepseek/doubao/qwen各15场真实预览UI；135轮尝试133条NPC成功正文，2次中档李明辉告辞SSE503，43场服务端结束。135轮截图+3配置截图，原Provider恢复deepseek revision5。运行时prompt-config revision5，五人三档示例均已加载。预约由测试调节accepted并跳过准备；正式对局/邀约全过程未测。
- outputs/2026-10-12-NPC多模型拜访截图索引.html与对照报告.md，原始summary/responses及截图在harness/evidence/npc-model-visits-2026-10-12/。runner的43场dialogue-completed-not-ended是200ms采样早于UI650ms退场，不是产品失败；两告辞错误已据原始SSE单列。未保存认证令牌/密码/cookie。
- PROMPT-007口头语/承诺复现，新增009未核验具体事实、010生成投入梯度不稳定；TEST-VISIT-001仍待定位。只测试登记，未修产品。用户新增全量对话PDF，目标output/pdf/2026-10-12-NPC三模型全量拜访对话记录.pdf；需完成全部135输入/正文或系统失败完整性校验与视觉QA后收口。
- 上述PDF已完成46页，主线程对45场各自对应页的135输入+135输出共270项独立文本验证通过；全46页渲染及封面/最长/失败详情视觉QA通过，联系方式来源警示保留。138张索引图浏览器显示正常、坏链0。最终scripts/harness-check.ps1与git diff --check通过。无需重跑本批未变动的产品build/lint；原先未修问题不因PDF交付关闭。未执行Git提交。

## 2026-10-08 常见销售场景三档分化（本地实现与验证完成）

- 用户指出常见销售场景近似；v2 完整快照及源码证实五人各 10 条引用回复原本在 low/medium/high 完全复用。此前首段和人物化追加例句虽有差异，但共同场景并未分档，已纠正这一缺口。
- npc-role-prompts.ts 每人保留同 10 类标签，低/中/高分别 30 条独立回复，共 150 条；低礼貌简短必要回应，中平和务实核对一项，高更亲切主动、授权内有条件协助。敏感/礼品拒绝边界不变而表达不同。独立逐条比较确认 50 个场景每组三句不同；人物 base、原档位首段和 TIERED_SCENARIO_DEPTH 完整保留。
- prompt-config.ts 加入分化前完整稿四字段精确指纹，旧默认读取升级，自定义任一字段保留；test-npc-role-prompts.ts 增加对应场景逐条比較及插值完整性。新增回归已在旧稿检出完全重复，再在新稿通过。
- 主线程复跑人物、Excel、配置编辑、正式五人、预览专项及 TypeScript、全量 ESLint、Next/tsup 生产构建通过。后台只读 revision 5 五人历史 string 均归一化匹配新版默认；未物理写数据库或部署。本地 3000 已重启到最终构建，预览 HTTP 200。
- 完整稿 outputs/五人NPC提示词-常见销售场景三档分化-2026-10-08-v3.md；逐项对照 outputs/五人NPC常见销售场景-低中高逐项对照-2026-10-08.md。本批静态文本与契约验收，不宣称新稿真实模型语气稳定；PROMPT-007 和 TEST-VISIT-001 保持未解决。最终 scripts/harness-check.ps1 与 git diff --check 均通过。未执行 Git 提交。

## 2026-10-08 真实拜访验收完成（存在未修复问题）

- 最新本地生产构建真实预览：五人三档 API 15 场，75 个 preview 动作均 HTTP 200，45 个 visit_turn 中 44 条正文、1 次 NPC 告辞后的玩家收尾；浏览器另完成张中档准备/实际模拟和王低支持愉悦 0 连续施压共 2 场。只用独立设计师预览数据，未改正式对局。
- 样本中礼貌、敏感信息边界和结束流程正常；9/44 条正文口头语堆叠，7 个场次相邻轮复用。王拒绝末尾“您说是不是”违反基础稿；张“后续他们按职责跟您联系”承诺偏满。浏览器一次 preview 502 重试恢复，根因未确定。不能宣称话术质量全部通过或 502 已修复。
- 报告：outputs/五人NPC真实拜访测试报告-2026-10-08.md；原始 API、UI 原句与截图：harness/evidence/npc-visits-2026-10-08/。未保存令牌、cookie 或密码；provider/model 型号未从 DTO 核实。预约由测试调节设置，未覆盖邀约申请全过程；正式模式未测。
- 本批只测试、证据和台账；下一步在批准修复范围后处理 PROMPT-007 和 TEST-VISIT-001，复跑针对性真实样本。原有本地技术验证记录保留，不代表当前真实话术全部达标。

## 2026-10-08 人物口语与情境示例二次修订（本地实现与验证完成）

- 用户纠正了口头语定义，并否定首版四人的办事用语；已保留张建国三句，重写四人习惯短语，并为五人三档增加有个人差异的场景示例。实际文本与旧内置精确升级、自定义保护复核后已导出 `outputs/五人NPC提示词-人物口语与情境示例-2026-10-08-v2.md`。下方首版仅为历史实现记录。
- 最终全量 ESLint、`scripts/harness-check.ps1` 与 `git diff --check` 均通过；未 Git 提交。下一步部署后需看真实对话中口头语自然程度与复读情况。
- 本批文本复核完成：四人换为随口承接/停顿/转折语，五人三档新增 45 条性格化情境示例；王德福、刘思琪语气按权威人物主档修正。`scripts/fixtures/npc-role-prompts-2026-10-08-before-tone-refresh.json` 保留首版，`prompt-config.ts` 仅全四字段指纹一致才读取升级。
- 主线程人物/Excel/配置编辑/正式五人/预览 AI 专项、类型、Next build 及 tsup 服务端构建通过。完整 Markdown 已导出。后台只读实查 revision 5 五人历史 string 全部归一为当前默认；未物理写数据库、未部署、未在线模型对话验收。

## 2026-10-08 NPC 客气表达与个人口头语

- 最终收口：完整稿导出成功；最终 TypeScript 及后台只读归一化复核通过，`scripts/harness-check.ps1` 和 `git diff --check` 通过。未执行 Git 提交。

- 实现入口：`projects/src/lib/designer/npc-role-prompts.ts` 的五人基础稿/十五档例句；`prompt-config.ts` 的低愉悦礼貌底线及 9/30 全字段指纹；`customer.ts` 的通用礼貌追问/拒绝规则。旧 profile fixture 位于 `projects/scripts/fixtures/npc-role-prompts-2026-09-30.json`，测试覆盖所有字段自定义保护。已有其他未提交工作保留。
- 主线程已复核实际例句、读取归一化与 diff；人物、Excel、配置编辑、正式五人、预览 AI、Provider mock、TypeScript、全量 ESLint、Next build 及 tsup 服务端构建通过。沙箱初次依赖/本机网络错误在完整权限环境同命令复跑通过。
- 后台只读实查 revision 5：五人均为历史 string，当前读取归一化全部匹配新内置 profile；未写远程物理 JSON、未部署、未调用真实模型。本地默认完整稿已导出到 `outputs/五人NPC提示词-礼貌与口头语版-2026-10-08.md`。下一步部署后抽查五人三档、拒绝/支持/催问/不悦和邮件场景的实际语气及口头语频率。

## 2026-09-30 五人三档情境话术扩充（本地实现与验证完成）

- 五人基础稿及十五份档位正文在 `projects/src/lib/designer/npc-role-prompts.ts`。基础稿恢复适度人物动机、生活、渠道、职责和固定边界；每档覆盖代表性销售话术并给自然例句，新增跨情境的档位处理差异。参考中的金主任个人事实、#MT 占位、预算和结果承诺均未移入五人提示词；自我介绍只按人物性格提醒。
- `prompt-config.ts` 的旧内置精确读取升级、自定义保护及代码选档仍有效。主线程复跑人物、Excel、配置编辑、正式五人、预览专项、TypeScript、全量 ESLint、Next/服务端构建通过。远程保存 JSON 未实查或改写；部署后需做五人低/中/高、四渠道的真实模型对话抽查，特别看示例复读和虚构承诺。

## 2026-09-30 五人三档提示词内容重整（本地实现与验证完成）

- 五份新版 profile 位于 `projects/src/lib/designer/npc-role-prompts.ts`；每份基础稿简短，三档各有行为规则及三条可改写示例。`prompt-config.ts` 只对精确旧内置 string 或完整旧 profile 作读取升级，设计师自定义稿不替换；所有正式/预览/设计师读取均走该归一化。远程物理配置未改写，设计师下一次保存后才持久化新格式；上线需检查真实保存值及模型对话。
- 主线程复跑五项专项、TypeScript、全量 ESLint、Next/服务端构建、`scripts/harness-check.ps1` 与 `git diff --check` 均通过。

## 2026-09-30 五人 NPC 支持度分档提示词（本地实现与专项验证完成）

- 本批入口和目标见 `plans/CURRENT_ITERATION.md` 顶部及 D-090。用户补充明确门槛数值应在设计师界面可调、选档由代码完成，写话模型只接收选中档位正文。正式 `/api/chat/stream`、五人预览、设计师提示词库与 Excel 都需要按统一三档契约核对；旧已保存配置可能覆盖默认稿，远程实际值本批尚未实查。
- 代码现以 `prompt-config.ts` 的共享门槛选择五人各自档位；设计师提示词页可维护门槛和基础/低/中/高四项，Excel 可导出新四行并导入旧单行。正式和预览生成模型不接收门槛或完整支持度分档条件。主线程复跑相关五项专项、TypeScript、全量 ESLint、Next/服务端构建、harness 和 diff 检查通过。上线前需核对远程 `designer_prompt_configs/project-one` 的当前保存值，并做跨档真实对话观察；本批未实查或改写远程配置。

## 2026-09-29 五人提示词视角与发言身份

- 五人 `npc-role-prompts.ts` 的直接职责/行动/输出规则已按 D-089 统一 NPC 第二人称；正式 `/api/chat/stream` 在事务提交前进行发言身份校验、一次纠偏或安全兜底。预览 `visit_turn`、`wechat_request` 补 `speakAsNpc` 和质量门；原有消息/电话质量门继续有效。
- 当前后台 `designer_prompt_configs/project-one` 已通过 revision 条件更新五份人物提示词，版本 4→5，读回确认其他字段未变。`20260929000100_npc_speaker_perspective.sql` 是供其他环境部署的幂等迁移；当前数据库内容已同步，但没有将该 SQL 登记为远端迁移已执行。
- 相关专项、TypeScript、全量 ESLint、Next 和服务端构建通过。运行实例需要更新代码才能启用新增正式/拜访防护；部署后应做张建国电话、拜访、微信及正式聊天的真实模型多轮验证，重点观察角色反转和误拦截。

## 2026-09-29 测试调节数值与 Jev 延迟

- 当前本地设计师 Jev 配置页显示已保存 Jev 决策开关。代码上电话消息路径串行约两次 Jev 与两次正文 LLM；Jev 请求默认 30 秒超时与两次重试。尚无分阶段真实计时，不要把整段等待归因于 Jev。用户要求保留原预览 SSE 逐字播放效果，已恢复原分段等待；后续性能调查应聚焦外部调用与重试。
- 预览服务 `project-one-preview-ai.ts` 在所有成功 POST 输出五人 `npcTestStates`；新 GET 恢复由 `api/project-one-preview/ai/handler.ts` 返回相同快照，GET/POST 只给设计师并保持 owner 隔离。正式 `/game` DTO 不变。前端 `public/project1-prototype-v9.html` 以 GET 同步测试调节数值，POST 后更新，缺字段/403/失败隐藏旧缓存。
- 主线程使用本地浏览器验证新 UI：新标签中的 42/68 测试调整提交成功，但 5000 运行进程的 GET 尚无新字段，因而新前端按设计显示“服务端没有提供完整的 NPC 状态快照”并隐藏旧值。该测试预览会话随后已重置。需更新运行的服务端实例再做浏览器端到端验收；不要误将当前 5000 返回视为新 GET 实现失败。mock 鉴权、UI 行为、预览 AI、流分段、隔离和构建已过。

## 2026-09-29 电话历史记录显示

- 预览 `public/project1-prototype-v9.html` 现在以独立 `phoneHistory` 保存通话次数、时间、阶段和状态，旧快照仅有拨号次数时生成“时间未记录”的条目；`activePhoneCallId` 只在当前页内存中，刷新、挂断、换人或切视图后不会再显示历史正文。旧会话正文仍保留在原对话存储供后端上下文/审计，不再由电话 UI 渲染。
- 正式 `/game/page.tsx` 从 `/api/game/sessions/[id]/call-history?npcId=` 读取元数据；接口按归属读取 `game_events` 的 `npc.call.connected`、`npc.call.unanswered`，兼容 work_phone `contact.completed`。响应只有 `id/npcId/outcome/round/createdAt`；错误有重试 UI。当前通话正文用拨号时刻隔离，离开电话视图/未接/刷新后隐藏。
- 本地主线程通过 `test-call-history-api.ts`、`test-preview-call-history-ui.ts`、旧 UI 契约、预览账号隔离、`tsc`、全量 ESLint、Next build、tsup、`git diff --check`；请在有真实登录与数据库环境时再做两页面手工拨号/刷新验收。远程数据库未实查，无新迁移。

## 2026-09-29 预览电话角色反转

- 截图来自 `public/project1-prototype-v9.html` 的预览电话，后续玩家话术走 `message/work_phone` 到 `/api/project-one-preview/ai`。预览 `content` 原本只校验 JSON 和长度，模型把玩家称为“张总”、以供应商身份讲话也会被保存；不能只归因于某版提示词。
- 修复在 `src/lib/game/project-one-preview-ai.ts` 的消息生成入口：针对目标 NPC 检查称呼/供应商自称，最多一次纠偏，再失败短兜底；旧错误 NPC 回复仍在原始会话供追溯，但不会传给新一轮生成。`scripts/test-project-one-preview-ai.ts` 有截图型 mock 和正常首轮电话自介回归。
- 本地读取远程 `designer_prompt_configs/project-one` 返回 `fetch failed`，未确认实际保存提示词版本；真实在线模型还需后续测试。正式 `/api/chat/stream` 不使用这条预览质量门，若正式聊天出现同类角色反转，应另行补正式发出前校验。

## 2026-09-29 后台 AI 接口切换与 Qwen

- 新增 `/designer/ai-provider` 和 `/api/designer/ai-provider`，配置在 `designer_prompt_configs` 的 `global-ai-provider` 行，允许 `default/deepseek/doubao/qwen`，写入使用 revision CAS。`client.ts` 仅在调用方未指定 Provider 时读取该选择；显式轨道覆盖全局选择。
- 部署 Qwen 前配置 `QWEN_AI_BASE_URL`（地域对应 WorkspaceId 兼容地址）、`QWEN_AI_API_KEY`、`QWEN_AI_MODEL`，并重启服务；页面只显示配置状态和模型名，不回传 Key。当前本地缺 Qwen 变量，未做真实请求或远程数据库保存验证。请在真实环境选中 Qwen 后实际发起一轮正式/预览正文请求，核查失败码和返回文本。

## 2026-09-28 正式体验同步与支持度脱敏（已完成本地实现与验收）

- 用户指出正式游戏应先同步设计师后台“实际测试”的体验，再基于该体验实现招标机制；玩家侧不能显示支持度。此前 GAME-015 的完成声明仅覆盖旧 `/game` 链路，现已完成后续 UI/行动同步与本地验收。
- 已核实：设计师“实际测试”从 `src/app/designer/page.tsx` 进入 `/project-one-preview`，该路由 iframe 承载 `public/project1-prototype-v9.html`。预览 AI/拜访会话走 `src/app/api/project-one-preview/ai/route.ts` 与 `project_one_preview_sessions`；原型的阶段/AP等部分状态仍在浏览器，提交结果是样例。正式游戏走 `src/app/api/game/sessions`、`[id]/commands`、`executeGameCommand` 与 `game_runtime_states.simulation_state`，具备正式命令和结算。不要把预览会话或浏览器进度直接作为正式存档。
- 支持度脱敏已实现：正式 game/result 页面隐藏支持度数值/档位，session/commands/messages/result DTO 与复盘上下文已脱敏；设计师样例结果也不显示支持度，测试调节面板仍可设置支持度。支持度仍供服务端内部规则与结算使用。
- 用户已确认并采用 D-084：保留正式 `game_sessions`、命令 reducer 与结算唯一权威，按设计师实际测试同步 UI/行动；preview 会话与浏览器阶段/AP不迁入正式存档。同步改动和支持度脱敏均已验收。
- 正式后端行动有 `work_plan`、`postal`、`brief_visit`、直访和服务端拜访进度判断；`evaluateFormalVisitTurn` 的可信字段由 `recordMeetingTurn` 校验并记录任务与 `endReason`。前端工作台使用正式 `/game` React 页面和 `game-board.module.css`，未将业务状态改由 preview/sessionStorage 管理。
- 最终验证：主线程确认 12 组相关 TSX 测试、`tsc --noEmit`、`eslint . --quiet`、`next build`、`tsup src/server.ts`、`scripts/harness-check.ps1` 与 `git diff --check` 均通过。
- 限制：没有执行登录态、数据库支持的真实 UI E2E，也没有实查远程 Supabase；记录的完成状态仅基于本地专项/状态测试、类型/lint/build/harness 验收。GAME-015 已关闭；preview 与正式存档仍保持独立。

## 2026-09-28 三家供应商招标与结算机制（旧 `/game` 链路本地实现与验证记录）

- 本节列出的早期页面显示内容和实现文件反映 D-083 初次落地时的旧 UI 状态；支持度可见内容已由上方 D-084 脱敏实现移除，正式实际测试 UI/行动同步已在后续完成。
- 用户已批准完整三家中标模型，并要求在新的三家比较中保留原综合评分因素；D-083、GAME-015 和当前迭代条目已登记。主线程确定的供应商画像为：`player-company` 技术精度 / `technical_accuracy`，`abc-company` 最低价 / `lowest_price`，`xyz-company` 功能完整度 / `feature_completeness`。
- 实现文件：`projects/src/lib/game/bid-rules.ts` 定义 4 档支持态势、4 种规则与匹配分；`game/project-one.ts` 定义三家供应商画像；`game/state.ts` 持久化支持矩阵、bidRule、建议历史，负责自动规则变化、建议采纳与确定性三家结算；`contracts/game.ts` 添加 `propose_bid_rule`；`repository.ts` 保存 JSON 状态并把公开结算摘要加入复盘白名单；`app/game/page.tsx` 和 `app/result/page.tsx` 展示过程与结果。设计师竞品 CRUD (`designer/competitors.ts`) 仍是 legacy 描述信息接口，运行时画像目前来自规范 `PROJECT_ONE_SUPPLIERS`，扩展 CRUD 需另接配置契约。
- 实际默认阈值：加权支持均值 HIGH≥65 且≥60% 决策权重支持值≥60，MID_HIGH≥50，MID≥35；提议 HIGH 目标人≥50，MID_HIGH 决策权重≥0.18/目标人≥55/均值≥50，MID 权重≥0.24/目标人≥72/均值≥35，LOW 无采纳通路。建议耗 2 AP，每个 NPC/规则组合只能提出一次。三家综合候选分 = 玩家既有最终综合分或对手基础竞争分 + `(供应商加权支持均值−50)×0.3` + 规则匹配分；规则分为不匹配 2、综合中性 8、匹配 `12+round(优势值/25)`。分数降序后按支持均值、规则匹配分、供应商 ID 稳定排序；精确竞品分不向玩家展示。结算原因明确提及基础竞争力、支持和规则匹配，并显示赢家规则/核心优势；旧分数在 UI 标为我方方案表现分。更多见 CURRENT_ITERATION。
- 复核范围：主线程验证 `test-bid-rules`、`test-game-state`、`test-five-stage-state`、`test-review-context`、`test-competitor-ai`、`test-formal-five-person`、`test-ai-attitudes`、`test-legacy-ui-contracts`；`tsc --noEmit`、`eslint . --quiet`、`next build`、`tsup` 服务端构建均 exit 0。由于机器装有 pnpm 11.19 而项目要求 9，本批通过本地 `node_modules` 可执行文件验证。
- 限制：未执行远程 Supabase 检查或数据库 E2E；没有迁移，依赖既有 `simulation_state` JSON 持久化和归一化默认值。阈值及评分系数属于当前可调基线，尚未通过远程/实战数据校准。本工作项已完成本地验收；后续若将设计师竞品配置与规范画像统一，需另开工作项。

## 2026-09-23 全局结构化决策 Provider 开关

- `/designer/jev-config` 的顶层 `config.decisionProvider` 为 `jev|llm`，既有 `project-one-jev` 记录无字段时归一到 Jev，保存仍受 revision CAS 控制。设计师编辑 Jev 指令在 LLM 模式暂停但不删除；重新切回 Jev 继续使用。
- `jev-designer-config.ts` 的 `invokeConfiguredJev` 在默认业务调用读取配置后统一路由；LLM 由 `llm-decision.ts` 用现有 OpenAI-compatible 客户端回答相同 typed questions，简化 JSON 被严格转换并经 `validateJevResponse`。提示词测试在 LLM 模式使用本轨道的 named Provider，正式/预览使用默认 AI_*。测试注入式 invoker 不查询配置。
- 配置读失败不是空记录，调用方应使用确定性兜底；不要改回“读失败默认 Jev”，否则保存 LLM 模式时可能无意跨 Provider。新增决策任务时需加入目录和统一路由。7 项专项、Jev Provider、正式五人后端契约、TypeScript、全量 ESLint、Next.js/服务端构建通过；60 轮 live NPC 测试因默认 AI Provider 网络错误未完成，未实查远程 DB 保存、真实模型效果和性能。下方 2026-09-23 旧 Jev 编辑章节关于读失败沿用 Jev 的文字已被本节替代。

## 2026-09-23 Jev 人物画像与值预览

- `jev-npc-profile.ts` 从 `PROJECT_ONE_FIVE_PERSON_NPCS` 提取静态 Jev 决策画像；`buildJevNpcProfile` 给单人判断，`buildJevCandidateNpcSummaries` 给计划匹配。未知人物 ID 返回 `undefined`，正式状态省略该字段，不串用其他 NPC。
- 正式 NPC/礼品、固定张建国提示词测试及五人预览的 NPC 评估、消息/附件、微信、拜访准备/回合均带具体人物画像；计划匹配携带五人的紧凑摘要。`/api/designer/jev-config` 的 `npcProfiles` 和 `candidateNpcProfiles` 由同一 helper 输出，前端只读展示实际静态值。question 结构未动。
- 当前页不提供某一局当轮完整 Jev 请求记录；玩家输入、关系数值、记忆等动态值需在具体请求生成时才确定。完整人物角色提示词仍供写话 LLM，不作为 Jev typed 协议指令。新人物或主档字段变更时需检查画像字段和 `test:jev-npc-profile`。
- 逐人请求专项、Jev 配置、五人预览、提示词测试、NPC 态度/礼品与竞品回归、类型、全量 lint、Next.js 和服务端构建通过；真实 Jev 账号烟测仍未执行。

## 2026-09-23 Jev 决策配置编辑

- 设计师入口 `/designer/jev-config` 位于素材库。`/api/designer/jev-config` 使用“工作流编辑”权限；GET 返回 task catalog、当前配置及 revision，PUT 携带 `expectedRevision` 与 `config.tasks`，冲突为 409。存储使用 `designer_prompt_configs` 的 `project-one-jev` 独立行，不需要新迁移。
- `jev-designer-config.ts` 维护任务目录、默认空配置、白名单和状态/问题文字覆盖。每次默认 Jev 调用读取配置；保留注入式 mock 调用。新增决策任务或 question key 时需同步业务构造、目录和 `test:jev-designer-config`，避免页面展示/白名单漂移。
- 编辑页只展示动态 state 的字段说明，不展示玩家真实请求快照。`stateGuidance` 作为额外指导与原 state 同送，非空 questionInstructions 替换对应题目的默认 instructions；所有 type/criteria/候选以及后续确定性校验仍由代码掌控。数据库配置读取失败时默认 Jev 请求继续使用代码原文。
- 专项、Jev Provider 与业务回归、TypeScript、全量 ESLint、Next.js 与服务端构建通过。尚未进行真实 Jev 账户或远程数据库的人工保存烟测，交付时不得宣称已验证。

## 2026-09-23 五人预览账号切换修复

- `projects/public/project1-prototype-v9.html` 的 `STORAGE_KEY` 与 `PREVIEW_SESSION_STORAGE_KEY` 现在按 `weixun_identity.userId` 派生专属键，并在 JSON 中再次保存 owner；读取时双重校验。账号变化通过 storage/focus/pageshow/visibility 事件或请求前检查切换完整快照；身份与 token 不同步时暂停请求，旧请求的返回、流式片段和调用方后续写入由代次/取消结果隔离。新增异步 UI 动作时，若 await 后会写 `state`，也应检查用户代次。
- 旧固定键无 owner，页面首次加载会清除旧 `project1_interactive_prototype_v9`、`v10` 和 `weixun_project1_preview_session_v1` 三份当前标签页缓存。无法安全判断其账号，不可直接迁入新用户；服务端数据库会话不受影响。404/410 只重置当前登录用户的本地完整预览态，401 保留其本地缓存等待重新登录。
- `project-one-preview-session-repository.ts` 的 `toPreviewPersistenceError` 只读取 PostgREST 普通对象的 `message`，精确 SQL token `PREVIEW_SESSION_NOT_FOUND` 与 session mismatch 返回通用 404；其他数据库故障返回 503。数据库 acquire/commit/load 的 `id + user_id` 条件和 RLS 未改变。
- 验证入口：`test:preview-account-isolation`、`test:preview-session-errors`、`test:project-one-preview-ai`、`test:preview-test-controls`、`test:legacy-ui-contracts`；另检查 TypeScript、全量 ESLint 与生产构建。行为测试使用浏览器存储/请求的 VM 模拟，真实双账号浏览器人工验收可在下一次现场测试补做。

## 2026-09-23 Jev 决策层

- Jev 客户端位于 `projects/src/lib/ai/jev-client.ts`，与 OpenAI-compatible `client.ts` 完全分离。部署至少设置 `JEV_API_KEY`；默认 endpoint 为 `https://api.typesafe.ai/v1/systemone`、模型为 `jev-latest`，其余 `JEV_*` 变量见 `.env.example`。不要把 key 加到 `NEXT_PUBLIC_*` 或提交 `.env.local`。
- 结构化选择已覆盖 `npc-evaluation.ts`、`competitor-stage.ts`、`prompt-test.ts` 和 `project-one-preview-ai.ts`。扩展新流程时先区分“改变状态的有限选择”和“只供人阅读的文字”：前者给 Jev，后者给现有 LLM；合并时逐字段挑选，禁止 spread 未验证的 LLM JSON。
- Jev 错误只允许确定性兜底，禁止为了可用性调用原 LLM 代替判断。离散整数状态用 `choice`；只有允许连续/加权结果时才使用 `score`。任何结果仍须经过业务 schema、硬规则和 reducer。
- 验证入口：`test:jev-provider`、`test:competitor-ai`、`test:ai-attitudes`、`test:project-one-preview-ai`、`test:prompt-test`、`test:formal-five-person`。配置真实密钥后先运行 `local:check:jev`，再执行人工真实场景烟测；本批未使用或记录用户密钥。
- `test-wechat-expressions` 当前有一个与本批无关的基线静态断言：它要求 HTML 包含“NPC 已明确结束交流。你可以最后回应一次”，但 `511cde8` 已无该字面量，本批也未修改该 HTML。后续应按当前 UI 契约单独处理，不要误归因于 Jev 分层。

## 2026-09-22 张建国办公室沉浸式拜访样板

- 五人预览的 `state.meeting` 存在时，`render()` 会跳过顶栏和三栏工作台，直接渲染 `visit-immersive`。`refreshWorkspaceBody()` 在会面期间改为完整重渲染，不要再假定存在 `.workspace-body`。
- 张建国背景优先键为 `visit_scene:leader_office`，回退 `visit_scene:office` 与内置深色背景。五档表情读取 `person_expression:<npcId>:<expression>`，缺失时回退 `person_intro:<npcId>` 和本地介绍图。
- `npcExpression` 是正常拜访响应的可选安全枚举；分档为 0–19 angry、20–39 serious、40–59 calm、60–79 pleasant、80–100 very_happy。不得用它扩张响应去下发愉悦度或支持度原始数值。
- 本批是 `/project-one-preview` 的张建国样板，正式 `/game` 未迁移该界面。如果用户确认效果，再把模板抽象到其他人物/场景并单独设计正式链路的集成方式。

## 2026-09-22 场景按钮与预览图标视觉修复

- `projects/src/app/globals.css` 中 `.bg-role-designer` 是设计师页面的浅色径向背景，不是可与白字搭配的实色按钮工具类。场景新增/保存按钮已改用明确深紫实色；后续不要把它们改回 `.bg-role-designer`。
- `projects/public/project1-prototype-v9.html` 的行动点和竞品情报图标保持相同 32×32 容器，分别用 `.gold-icon svg` 和 `.violet-icon svg` 做半像素光学校正。这是路径重心差异，不需要改卡片布局。

## 2026-09-21 场景素材已改为动态数据表

- `/designer` 素材库通过 `/api/designer/scene-assets` 管理独立 `designer_scene_assets` 记录，支持 GET/POST/PUT/DELETE；人物介绍图和表情图继续使用 `designer_image_assets` 固定槽位，不要把动态场景重新塞回人物素材表。
- 开发库已应用 005 迁移并有 5 条正式场景记录：`company_lobby`、`restaurant_private_room`、`leader_office`、`conference_room`、`bar`。五张 Storage PNG 均实测可访问；临时 CRUD 验证记录已删除。
- 正式 `/game` 仍有自己的固定背景。后续接入游戏时必须先定义地点到场景记录的选择规则，不能仅凭名称把会议室、电梯或两个办公室风格静默合并。

## 2026-09-21 正式五人已切换

- 正式 `/game` 的唯一人物源现由 `project-one-five-person.ts` 派生，ID 为 `P1-001`～`P1-005`。不要恢复 `p1-frontline-wang-hao`、`p1-procurement-liu-kai`、`p1-minister-chen-jianguo`、`p1-deputy-zhao-feng` 或任何人物映射兼容层。
- 玩家单机入口固定进入 `/game?location=project-1&mode=solo`；`/project-one-preview` 只保留设计/测试预览。正式状态、消息、拜访、阶段、行动点、提交、结算和复盘均以 `/game` 服务端会话为权威。
- 开发库应用 `20260921000400_replace_project_one_four_person_saves.sql` 前实查 10 个项目一正式存档均为旧四人，五人/未知存档和项目一房间均为 0；迁移后旧存档为 0。临时创建并清理的新存档完整持久化五个新 ID，30 条素材未变。
- 多人基础建局会使用五人状态，但本批没有新增多人实时广播。预览共享限流、完整审计 DTO 和发布级真实模型/PDF 证据继续按原问题项推进，不得重新打开 FRONT-006 来替代这些独立问题。

## 2026-09-21 台账真实性规则

- 根 `AGENTS.md` 的“台账真实性硬约束”是全仓交付门：开始前必须实查代码、迁移、数据库/Storage 与测试，不能凭 ISSUE/STATE 直接判定未做；结束前必须做“实际实现 → 台账”和“台账声称 → 实际实现”双向复核。
- 实现类文件有变化时，`scripts/harness-check.ps1` 要求 STATE、CURRENT_ITERATION、ISSUE_REGISTER、HANDOFF 四份台账全部同步，否则退出 1。新决定与新发现仍需分别写 DECISIONS/FINDINGS。
- 自动门只检查必要台账是否同批变化，不能替代内容审阅。后续执行者必须把实查入口、已完成部分、确认缺口、本批不动部分和验证证据写清，部分完成不得标 Resolved。

## 2026-09-21 持久化与设计能力批次

- 25 张人物表情图已在真实 Supabase/Storage 逐一确认，元数据、对象和公开 URL 均有效；原 4 个固定拜访场景空槽已由同日动态场景表取代并导入 5 条记录。不要再按旧台账把表情或场景当空位，也不要在没有产品规则时自行把情绪状态或拜访地点映射到图片。
- 新迁移 `20260921000100_project_one_preview_sessions.sql`、`20260921000200_prompt_test_sessions.sql`、`20260921000300_scenario_competitor_config.sql` 已应用开发库。五人预览和提示词测试会话已跨进程持久化，命令含请求哈希、版本、唯一幂等与可续租短租约；失败不提交候选状态。
- 五人预览 GET 恢复只返回安全玩家态，不下发隐藏支持度、阻断、工作记忆、Evaluator 理由或附件正文。完整内部审计快照仍是 STATE-004 剩余项。
- 单机竞品阶段动作已走真实结构化模型协议，失败确定性兜底；设计师竞品配置已有真实 CRUD、权限和 revision 冲突处理。四类性格字典已统一主档、Prompt、页面和 Excel。
- 多人实时同步本批明确未动。该段关于旧 `/game` 四人链路的描述已由同日后续正式五人切换取代；共享限流、完整审计 DTO、真实双模型/PDF/多尺寸发布验收仍待完成。
- 验证已完成：真实开发库跨实例恢复/重放/改包拒绝/版本推进，远端 migration 对齐与 db lint 0 error；相关专项、TypeScript、全量 ESLint、生产构建通过。临时数据库验证数据已清理。

## 2026-09-20 五人人物背景已写入系统

- 五份默认提示词的“一、人物定位”与“二、话题判断”之间已加入“人物背景和当前处境”；源文件为 `projects/src/lib/designer/npc-role-prompts.ts`，审阅稿为 `outputs/五人人物提示词完整稿-2026-09-20.md`。
- 当前开发库已应用 `20260920000300_enrich_five_npc_backgrounds.sql`，revision 4，五项与代码逐字一致。
- 背景不属于公开人物资料，不新增响应字段或每轮独白。后续修改背景仍应同步默认源、审阅稿和持久化提示词迁移，并运行 `test:npc-role-prompts` 与 `test:prompt-excel`。

## 2026-09-20 赵晓晨执行定位、拜访自动结束与人物背景计划

- 赵晓晨唯一目标定位为“项目执行人员／项目执行”，直属李明辉。主档在 `project-one-five-person.ts`，完整角色规则在 `npc-role-prompts.ts`，页面资料在 `project1-prototype-v9.html`；审阅稿已同步。
- 开发库已应用 `20260920000200_update_zhao_project_executor_prompt.sql`，revision 3；该迁移同步李明辉、王德福和赵晓晨三份受定位变化影响的提示词。
- 五人预览拜访协议新增双方结束信号、`npc_time_constraint`、`npc_farewell` 与 `awaitingFinalReplyFrom:'player'`。NPC 告辞后下一条玩家消息只保存并结束，不再调用 AI；`end_visit` 在此状态返回 `FINAL_PLAYER_REPLY_REQUIRED`。
- 不实施逐轮内心独白。后续从 `harness/plans/NPC_BACKGROUND_DEPTH_PLAN.md` 开始，在原始人物提示词中补充稳定的背景处境与内在顾虑；不新增输出字段、展示或评分逻辑。

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

C0采用用户授权的新正向规则（D-052增量），不是恢复原稿。五人合规解除只核验本轮训练表达，不证明现实整改已完成。正式五人业务存档已于 2026-09-21 切换；共享限流和完整真实双模型/PDF/多尺寸验收仍由 STATE-002 与 TEST-003 跟踪。

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
4. FRONT-002/003/006 已完成。五人预览仍是独立测试设施，玩家正式入口统一走五人 `/game`；后续补共享限流和完整审计时不得重新建立双写。旧工程待办仍包括 MULTI-002/004、DATA-001 和 UX-005。
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

## 2026-10-08 sellsmart 公开首页

- 首页 src/app/page.tsx 与 landing.module.css；原登录 src/app/login/page.tsx。品牌 public/brand，插画 public/images/landing/sales-training-hero.png；生成提示词与使用方式见 public/brand/README.md。根 layout 标题/图标同步 sellsmart。
- 本地开发服务 http://127.0.0.1:3000。主机默认 pnpm 11 不符合项目要求，使用缓存 pnpm 9：node C:/Users/17628/AppData/Local/node/corepack/v1/pnpm/9.0.0/bin/pnpm.cjs。沙箱下 Next/SWC 无法 canonicalize 项目目录，本地正常权限可运行。最终验收结果待补记。


### 2026-10-08 sellsmart 首页最终验收

- 本地实现与验收完成：`/` 为无需身份的首页，`/login` 为原登录，`/home` 保持玩家工作台。首页 SVG 品牌、模型生成插画和独立 CSS 已落盘；全局页面标题/图标同步 sellsmart。
- 主线程复核实际 diff；原登录 sendCode / handleLogin / enterWorkbench 的处理代码与 HEAD 原根路由逐字比较一致。
- 主线程验证：pnpm 9 TypeScript、全量 ESLint、最终 Next.js 静态页及 tsup 服务端构建通过。桌面 1440 与手机 390 视觉检查，图片加载、手机菜单、流程锚点、首页 → 登录 → 玩家身份 → /home → 退出回首页均通过。手机五阶段改为完整两列展示，页面无横向溢出。
- 证据：`harness/evidence/sellsmart-home-2026-10-08/desktop.jpg`、`mobile.jpg`、`hero.jpg`。FRONT-SELLSMART-001 状态为 Resolved（仅本地实现）；未发布到线上。本批未改数据库或实际训练规则，远程数据未实查，不声称对局/复盘新增完成。

## 2026-10-08 游戏入口简化（实施中）

用户要求原产品介绍保留备用，根路由改简洁游戏入口。当前已核查根首页为长营销页、/login保留认证、/start为项目选择；只调整前端展示/导航，原介绍完整迁至/about，复用游戏城市图片与sellsmart品牌，不涉及数据库或AI游戏状态。最终验证待补记。

### 2026-10-08 简洁游戏入口最终验收（本地完成）

- FRONT-SELLSMART-002：Resolved。`projects/src/app/page.tsx` 改为单屏游戏标题界面，`entry.module.css` 独立样式；`about/page.tsx` 保留原产品介绍，仅改导入路径及标题，主线程归一化逐字比较通过。原 CSS、品牌、生成插画均保留。
- 服务端验证 `weixun_session` 后选择入口；访客 `/login`，有效玩家 `/start`，其他有效角色对应原工作台。认证 API、游戏状态与数据库未改。
- 主线程最终验证：目标 ESLint、Next.js 生产构建（包含 TypeScript）和 tsup 构建通过；1440×900 与 390×844 实测均单屏无横向溢出。产品介绍链接与返回、访客开始游戏→登录、真实预置玩家登录后开始游戏→项目选择、退出回公开入口通过。
- 浏览器证据：`harness/evidence/sellsmart-entry-2026-10-08/desktop.jpg`、`mobile.jpg`。本地 3000 改用已构建生产版 `next start`，清除开发热更新缓存的暂态 CSS 缺失错误；最终导航正常。未发布线上，也未验证/调整远程数据库。

## 2026-10-08 首页背景与 LOGO 重设计（用户已批准，实施中）

- 用户明确拒绝现 LOGO，并要求首页背景不得复用游戏场景，需重新制作适合首页的素材。
- 已检查：`page.tsx` 原引用 `/game-park.webp`，`public/brand` 原图标为两条相交 S 曲线；本批仅替换品牌资产、独立首页背景和必要美术样式，不改变路由/登录或游戏规则。
- 目标：图像模型生成独立商务沟通/客户关系策略背景，中心留白承载标题和按钮；LOGO 重绘为清晰简洁 SVG，同步现品牌引用。桌面手机可读且单屏，原介绍页保留。
- 验收：新背景资源实际加载、不引用游戏地图，LOGO 小尺寸清楚；类型/lint/构建、浏览器视觉和 harness/diff 检查通过。

### 2026-10-08 首页专用美术 v2 验收（本地完成）

- FRONT-SELLSMART-003：Resolved。首页不再引用 `game-park.webp`，分别使用 `public/images/landing/sellsmart-entry-background-v2.png` 与 `sellsmart-entry-mobile-v2.png`。两张图用内置 image_gen 生成/编辑，提示词见同目录 `ENTRY-ART.md`；原游戏资源和 /about 内容保留。
- SVG LOGO 改为深墨蓝底、清晰居中的单条象牙白 S 路径与微小琥珀端点。主线程审查两个 SVG 实际内容，修正初稿垂直偏移；首页、介绍、登录及 favicon 使用原品牌路径，统一更新。品牌说明见 public/brand/README.md。
- 最终主线程验证：目标 ESLint、Next.js TypeScript/生产构建和 tsup 通过；桌面1440×900与手机390×844均单屏无横向溢出，新背景与标志实际加载成功，手机显示专用竖版图。路由/认证逻辑未修改。本地3000已重启为最终生产版；未发布线上。
- 证据：`harness/evidence/sellsmart-art-v2-2026-10-08/desktop.jpg`、`mobile.jpg`。本批只涉及美术与首页CSS/图片展示，远程数据未实查，无数据库或AI规则调整。

## 2026-10-12 工业竞标棋局首页美术（用户已批准，实施中）

- 当前证据：`projects/src/app/page.tsx` 引用 v2 商务会谈背景；用户认可整体风格，但要求地面棋局感、右侧招标文件示意、左侧工厂剪影。
- 目标与范围：只替换首页横版/竖版背景引用；保留深蓝暖金、标题按钮布局、LOGO、登录路由及备用产品介绍。用内置 image_gen 编辑并版本化保存 v3，游戏规则/API/数据库不变。
- 验收：棋盘地面、工厂与招标文件清楚，中心文案可读；桌面和手机图片正常加载且单屏；目标 lint、TypeScript/构建及 harness 检查通过。
### 2026-10-12 工业竞标棋局美术 v4 验收（本地完成）

- FRONT-SELLSMART-004：Resolved。首页横版与手机版引用 sellsmart-entry-background-v4.png / sellsmart-entry-mobile-v4.png；左侧工厂剪影、棋盘地面和右侧文件已接入，封面统一为 Invitation for Bids。
- 使用内置 image_gen 生成并编辑，v2/v3 素材保留；最终提示词与素材路径见 projects/public/images/landing/ENTRY-ART-V4.md。本批仅替换首页两个图片引用，无认证、API、数据库或游戏规则修改。
- 主线程确认最终素材拼写与实际页面；目标 ESLint、Next.js TypeScript/生产构建及 tsup 通过。1440×900、390×844 均单屏无溢出，当前可见背景加载成功，手机版专用竖图正常。
- 证据：harness/evidence/sellsmart-art-v4-2026-10-12/desktop.jpg 与 mobile.jpg。本地3000已启动最终生产预览；未发布线上。

### 2026-10-12 玩家身份与模式入口验收（本地完成）

- FRONT-PLAYER-MODE-001：Resolved。start/page.tsx 保留登录 subRole；企业员工显示原单机/联机选择，paid_individual 隐藏整块模式/房间输入；开始导航与按钮统一使用 effectivePlayMode，个人及身份未加载时固定 solo。非玩家其他角色保留原选项；未带子身份的旧玩家默认单机。
- 已完成部分：登录已写入完整身份；确认缺口：原项目入口丢弃 subRole。实际修改仅 projects/src/app/start/page.tsx；认证、游戏/API/数据库没有修改，远程数据未实查。
- 主线程实际 diff 复核；缓存 pnpm 9 ts-check、全量 lint:build、Next.js 生产构建及 tsup 均 exit 0。默认 pnpm 包装器沙箱 realpath EPERM，正常本地权限使用缓存 pnpm 9 完成检查。
- 浏览器验收：临时开发及最终 3000 生产预览通过；企业员工单机导航、联机选项/房间码/公司选择与联机导航，个人无模式选项/房间码且 solo 导航通过。使用模拟客户端身份、项目列表与联机加入响应，导航落点拦截，不创建真实对局；不宣称联机数据库或认证端到端另做实测。
- 证据：harness/evidence/player-mode-2026-10-12/check.cjs、enterprise.png、individual.png。本地 3000 已重启为最终构建，临时 3012 服务已关闭；未发布线上。
## 2026-10-12 正式游戏同步交接

- 本批完成 FRONT-FORMAL-SYNC-001，以 STATE.md 同日结果为当前结论。正式 /game 与后台实际测试页的玩家布局/流程/费用已同步，保留正式数据库与命令权威；隐藏测试调节没有进入玩家页。
- 代码主入口：projects/src/app/game/page.tsx、game-board.module.css；正式workflow独立准备/计划判断及输出有界化；chat/state负责已读不回、告辞、电话会话和附件扣费。无新数据库迁移。
- 最终3000生产预览正常（next start，本次pid20124）；开发3012已关闭。当前真实数据库读写与AI计划/准备验收已通过，临时用户存档清理验证完成。最终mock脚本设 E2E_BASE_URL=http://127.0.0.1:3000；真实脚本用 projects 本地tsx执行 check-live.ts，自动清理独有临时存档。
- 测试/截图报告位于 harness/evidence/formal-sync-2026-10-12。早期live失败分别为定位器重复、AI空正文、建议超量及计划充分性拒绝；前3项已修复，第4项保留正常门槛，具体多步骤计划成功保存。不得把mock聊天当真实模型多轮验收。未发布，保留全部原有未提交修改。

## 2026-10-12 两栏与限时流程收口

- 正式游戏和后台实际测试页已同步为两栏；阶段展示、阶段设置及旧推进接口停用。共享 public/project-one-notice.json 提供顶部简卡和采购通知弹窗。20min、每5min恢复5AP/上限28、实际拜访暂停且结束按最终轮数每轮15sec扣时、超时当前进度结算，测试页可调整剩余秒数和AP。
- 服务端计时使用runtime JSON、原子命令提交与版本重试；刷新不重置，普通轮询不增长版本，恢复和超时仅一次，拜访结束跨恢复边界同样处理。旧历史round仅存储兼容。多人等待不计时，同事务开局锚点，结束保护已结算公司并清理活动锁。
- 主线程最终复跑项目计时、竞争者检查点、11个RPC权限静态校验、reducer验收、桌面1440x900/手机390x844浏览器、真实隔离单人存档和双账号多人E2E均通过。已检查正式/测试桌面、手机和通知截图；完整TypeScript、ESLint、Next/tsup构建通过。证据 harness/evidence/game-timer-2026-10-12/。
- 迁移20261012000100已通过管理API事务应用至与本地配置匹配的关联开发库并登记迁移历史；实际查询确认11个变更RPC的anon/authenticated执行权限均关闭、service_role可执行。没有部署生产站点或重置数据库。本地3000运行最终构建。
- 真实AI超时请求验收被自动审批拒绝（外部模型项目上下文出站授权未确认）；未执行这些请求，另以本地模拟模型调用真实handler补充截止时间回归。此限制不代表既有模型服务质量已验证。原有NPC话术质量/偶发服务问题保持原状态，本批未扩大修复范围。

最终补充验收：主线程运行 `node -r tsx/cjs scripts/test-timer-late-ai.ts` 通过；脚本加载真实commands/chat handler，仅stub模型、身份和内存repository，证明过期epoch先结算、晚返回计划/自然邀约/普通邮件不提交业务效果、暂停拜访末轮可同事务扣时结算。新增脚本后完整TypeScript再跑通过。harness-check与按CRLF兼容设置的diff --check通过。

## 2026-10-12 张建国限定抽样审批状态

用户已批准张建国三模型测试范围；15条独立单轮计划检查通过，只含P1-001，无其他NPC档案。自动审批仍在执行前拒绝外发新版内部提示词，认为缺少对具体目的地和提示词内容披露的明确授权；本批实际发出0请求、产生0正文，未换通道绕过，TEST-SHORT-001仍Open。
只读核对配置目的地：DeepSeek deepseek-v4-flash -> https://api.deepseek.com；豆包 doubao-seed-2-0-lite-260428 -> https://ark.cn-beijing.volces.com；Qwen qwen-plus -> https://dashscope.aliyuncs.com。需要向用户明确列出上述目的地和新版张建国提示词/虚构输入的外发范围。记录：harness/evidence/npc-zhang-short-replies-2026-10-12/execution-status.json；报告：outputs/2026-10-12-张建国三模型短回复测试报告.md。

## 2026-10-13 张建国三模型短回复实测（授权后完成）

用户明确授权将新版张建国提示词和虚构测试输入发送至 api.deepseek.com、ark.cn-beijing.volces.com、dashscope.aliyuncs.com。按准备好的15个独立单轮提示词样本执行，无其他NPC档案、不改全局Provider或产品代码；本次自动审批允许执行。历史审批拒绝记录保留，不覆盖。
15请求完成：14有效JSON正文，1条DeepSeek敏感拒绝仅返回空白、记invalid_json；10条正文在参考上限内，4条超限都为Qwen。DeepSeek开场低/中/高35/46/56字、低长推销27字；豆包24/43/56字、敏感32字、长推销35字；Qwen62/51/84字、敏感47字、长推销87字。计数含标点，无截断、无maxTokens。
Qwen高档复述销售方输入，存在角色混淆；低开场误称“张建国您好”。豆包“你抓紧”仍不够客气，中档主动安排对接边界需加强。低长推销仍有追问/承接，尚不能判定自然结束达标。软字数规则跨模型不稳定；先建议加强角色、礼貌和单动作/收束约束，暂不据单轮样本做程序硬截断。TEST-SHORT-001的缺少新稿真实样本已解决，后续质量风险仍按PROMPT-007/009/010追踪并登记本次角色混淆。来源：harness/evidence/npc-zhang-short-replies-2026-10-12/approved-2026-10-13/summary.json及responses.ndjson。本批是直接提示词抽样，非完整UI拜访、非严格A/B，不能推断达标率或其他NPC表现。

张建国本次全量PDF已完成：output/pdf/2026-10-13-张建国三模型短回复测试记录.pdf（最终4页）。主线程独立核对15输入/14完整正文/空白错误全部保留，最终渲染视觉复核完成。报告outputs/2026-10-13-张建国三模型短回复测试报告.md已检查并修正Qwen低档新旧字数比较错误。产品代码本轮未修改。

## 2026-10-14 顶部竞争对手资料（实现与本地验收完成，真实REST联调受阻）

- 正式/game与后台实际测试加入顶部竞争对手简卡/详情弹窗；设计师“数据→竞品数据”可新增、修改和删除，公司名/简介/核心优势及行业/方案特点/代表经验/服务支持共七字段。后两端共享独立登录只读API，30秒/焦点/可见刷新，编辑同步详情、删除关闭弹窗，空配置和读取错误/重试可见。旧记录和旧更新兼容，不清空已有新字段。
- 主线程实际diff审查，修复正式旧token迟到响应保护；根复跑新契约/授权投影、预览VM资料/HTML转义/账户隔离、原账户隔离、倒计时、测试调节和项目计时均通过。全量类型、全量lint与最后补丁目标lint、Next/tsup生产build通过；最终本地3000 PID31864。浏览器根复跑设计师七字段PUT→共享mock store→两端读取，桌面1440/手机390详情、编辑/删除/空/重试等通过；API全mock无外部模型/DB调用，不能称真实保存联调。
- 关联开发库实际SQL确认原count1/revision0/ABC；仅默认未编辑资料条件的迁移20261014000100已事务执行登记，随后权威查询count3/revision1、原ABC保留。新增北辰数科和云桥协同明确是模拟企业，不覆盖设计师自定义/清空列表。未发布生产站点，原游戏AI、评分与计时未变。
- 当前REST TLS连接ECONNRESET，真实页面后台编辑→数据库→游戏读取的最终验收未完成；管理API SQL正常，写入预设并不代表REST链路健康。FRONT-COMPETITOR-PROFILES-001保持In Progress仅等待此真实联调；不假称线上可用。证据 harness/evidence/competitor-profiles-2026-10-14/（含mock边界）。下一步网络恢复后读取当前revision，测试可控资料编辑并验证两端刷新，避免覆盖用户后续自定义；无需再造CRUD。

## 2026-10-14 竞争对手单入口纠正完成

- 用户纠正已落实：正式与实际测试顶部只有一张“竞争对手”入口，与“项目背景”同排；逐公司第二排已删除。一个总弹窗包含所有已配置公司资料，动态编辑/删除/空配置/错误重试和身份响应保护保留。桌面及手机同Y由最终浏览器boundingBox断言通过。
- ABC为占位：纯contract helper、默认配置和公开API过滤legacy UUID101+ABC占位名称（已改名自定义记录保留）；迁移20261014000200已事务执行登记，开发库权威查询count2/revision2/abc_placeholder_removed=true。其他企业资料/顺序保留，隐藏竞争引擎历史占位不作为公开企业展示。
- 根线程实际diff/默认稳定ID与公开投影回归、预览总弹窗VM与身份/XSS回归、原账户隔离/倒计时/测试调节/项目计时验证通过；完整TypeScript、ESLint、Next/tsup build通过。最终生产3000已重启PID40216，根亲自复跑两端桌面1440/手机390总modal联动mock验收exit0，并查看两端桌面卡片和手机详情截图。harness/evidence/competitor-profiles-2026-10-14/已更新为本修正版证据（mock3真实fixture+ABC过滤；实际DB为2公司）。
- 本次布局和占位纠正已完成；原FRONT-COMPETITOR-PROFILES-001的真实REST联调仍受ECONNRESET限制，未把mock称真实保存或线上部署。旧“3家公司/逐公司卡条”是修正前历史记录，不能引用为当前布局或DB状态。

## 2026-10-14 竞争对手列表到单公司详情完成

- 正式游戏与实际测试同步为：顶部“竞争对手”单入口→公司列表（名称、行业、简述）→所选公司详情→返回列表。关闭/Esc/背景关闭后重开默认列表；后台更新会保留当前公司并刷新资料，删除当前公司退回列表；身份变化清选择。ABC过滤和顶卡同排不变。
- 根实际diff复核并运行新竞品VM、原账号隔离、倒计时、测试调节、后台契约回归通过；完整TypeScript、ESLint、Next/tsup build通过。最终本地3000重启为PID14388，根复跑最新桌面1440与手机390浏览器mock验收exit0，包括只显示所选公司详情、返回/再选、重开列表、编辑/删除/空/错误重试、同排、ABC排除、五联系人与AP/time不变。根已查看两端列表桌面、正式手机详情截图。
- 证据harness/evidence/competitor-profiles-2026-10-14/已更新为列表→详情版。所有浏览器API仍使用隔离mock；本次未改数据层/远程数据库。先前真实DB两公司/revision2、REST TLS联调限制保留，不能把浏览器mock写成真实保存成功。旧总弹窗全文展开记录仅为历史。

## 2026-10-14 竞争对手弹窗闪屏修复完成

- 预览竞品弹窗改为稳定shell；初开禁用其backdrop/modal入场动画，列表/详情导航和后台更新不替换窗口/遮罩，相同markup不替换body，保留焦点/滚动；导航重置滚动。其它通用modal默认样式与动画不变。正式React弹窗无同类重建路径，本批未无依据改正式实现，已纳入稳定性验收。
- 根实际diff检查，复跑竞品VM的shell/body写入计数、相同刷新与滚动、新旧身份/倒计时/测试调节通过；完整TypeScript、lint、Next/tsup build通过。根在最终生产3000 PID60284复跑桌面/手机浏览器mock：CSS animation-name均none，活动动画0，原modal/backdrop引用跨导航/刷新保持，相同资料不换body并保留焦点及真实非零scroll，正式计时poll稳定；原编辑/删除/列表详情/ABC过滤等回归通过。已查看最终预览列表截图。
- 证据competitor-profiles-2026-10-14/check-browser.cjs及report.md。旧版运行时baseline未取得，根因来自旧代码静态机制，不虚构旧版前后量化；最终浏览器为全API mock，无AI/外部请求。本批没有数据库变更或线上部署，旧REST联调限制保留。

## 2026-10-14 工作区归档提交（用户已授权）

用户要求将工作区未提交内容提交到本地Git。本批汇总现有源码、测试、迁移、版本化public素材、台账和验收报告/截图/PDF；未加入环境凭据、缓存或构建产物。根配置凭据逐字匹配及key/JWT/private-key扫描无命中，独立未跟踪文件审计未发现原始token/cookie。测试记录的临时UUID仅作证据保留。PDF按Git binary管理；仅纠正无行为变化的login空白与计时报告断行。源码暂存diff检查与harness检查通过，产品类型/lint/build与浏览器验收沿用本批已完成最终检查。本次仅本地commit，不push或部署。
