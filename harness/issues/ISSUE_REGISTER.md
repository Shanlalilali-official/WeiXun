# 动态问题台账

- 最后全面检查：2026-08-14
- 规则：问题只改变状态，不删除；解决必须记录证据。

## 本期问题

| ID | 优先级 | 状态 | 问题/目标 | 当前原因或下一步 |
|---|---|---|---|---|
| BASE-003 | P0 | Blocked | 本地 schema 与 API 实际用表不一致 | 已生成 17 表迁移；仍有 10 张历史 API 引用表未建模（清单见 BASE-008），需逐功能核验 |
| BASE-004 | P0 | Resolved | 完整固定纵向冒烟已通过 | `pnpm test:e2e` 覆盖建局、对话、隔离、恢复、关系动作、五轮结算和复盘 |
| BASE-006 | P2 | Open | ESLint 全量扫描慢 | 分析扫描范围并建立增量策略 |
| BASE-007 | P2 | Open | 全量 ESLint 存在 29 个历史错误 | 均为 `no-explicit-any`，集中在延期后台（coach/enterprise/game-data）与排行/设计师页面；本次改动文件 lint 已通过 |
| AI-003 | P0 | Resolved | NPC 消息持久化与刷新恢复已验证 | API 纵向测试与浏览器刷新后对话恢复均通过 |
| AI-005 | P0 | Open | 长对话滚动摘要未接入运行链路，接入后还会丢失事实/承诺账本 | `refreshConversationMemory` 当前没有调用方；其写回 `conversationMemories[npcId]` 时未保留 `confirmedFacts`、`commitments`。需接入聊天提交后的可靠异步/同步流程，合并现有记忆字段并补长对话回归 |
| AI-007 | P0 | Resolved | 真实模型 NPC 状态与复盘结构化协议已验证 | 发现复盘偶发 502 后增加 JSON 模式、严格约束与一次纠正重试；纵向回归通过 |
| AI-009 | P1 | Resolved | NPC 回复采用真实流式接收和平滑逐字呈现 | 首片前显示“NPC 正在思考…”，分片进入自适应逐字队列；浏览器实测正文在多个 200ms 采样点连续增长，页面卸载会取消请求和计时器 |
| DB-001 | P0 | Resolved | 完整迁移已推送到托管开发数据库 | `health_check` 只读查询成功并读到 seed 数据 |
| DB-002 | P1 | Resolved | 消息、状态、事件多次写入缺少完整事务原子性 | `commit_game_command` 已将聊天正文、AI评估、模拟时间、态度、库存、风险、事件和命令幂等记录收进同一版本化事务；真实E2E重试通过 |
| GAME-001 | P0 | Resolved | 五轮状态机已完成 DB 纵向验证 | 第 1 轮推进至第 5 轮并产生确定性结果，不进入第 6 轮 |
| GAME-002 | P0 | Resolved | 关系动作服务端扣点已完成 DB 纵向验证 | 节日祝福验证 28→25，亲密度 35→37，刷新保持 |
| GAME-003 | P0 | Open | NPC、软肋、线索解锁需完成语义验收 | 已修复亲密度越过剧情直接解锁；人物披露现兼容“业务部陈建国部长”等自然语序，读取旧会话时会扫描已保存的 NPC 回复并补齐解锁和一次提示。个人关注点等其余线索仍需逐项语义验收 |
| GAME-006 | P0 | Resolved | 对局、动作、消息、结果恢复已完成纵向验证 | API 与浏览器刷新恢复通过；E2E 测试结束自动清理测试数据 |
| GAME-007 | P0 | Resolved | 结算与 AI 诊断真实联调完成 | 真实模型复盘通过三数组结构校验并落库 |
| GAME-008 | P1 | Resolved | 关系动作已具备 NPC 偏好配置与结果拆解 | 固定基础值 + 人物偏好修正即时展示；AI 沟通评价在回复后并入同一结果卡。王浩、刘凯、陈建国、赵峰均有独立偏好/反感动作配置 |
| GAME-009 | P1 | Resolved | 闭环验收推进过慢，数值变化不易感知 | 增加独立快速验收账号；该账号新对局将关系动作和 AI 对话产生的亲密度、五维分数变化放大至 ×3，可从顶栏自行补充 1–999 行动点；操作点成本与五轮结构不变，普通账号固定 ×1 且无补点权限 |
| GAME-010 | P0 | Resolved | 项目一已具备模拟时间、邀约拜访和结算闭环 | 五个09:00–17:00模拟工作日、预约预留、5/40/60拜访、准备/纪要/跟进、第五阶段自动结算和混合公式均由真实E2E验证；不再使用真实倒计时或暂停 |
| UX-001 | P1 | Resolved | 新人物解锁已有显著反馈 | 首次新增 NPC 显示姓名、职务、发现说明与“立即对话”入口；历史对局若由服务端补齐人物，刷新后也显示一次提示，随后不重复弹出 |
| AI-010 | P0 | Open | NPC 跨人物转述状态机未实际运行 | `deliverPendingNpcHandoffs` 只有定义没有调用，聊天提交也未创建 `npc.handoff.promised`；当前 handoff 会立即改变目标 NPC 印象并通知玩家。需恢复 promised→sent→received 阶段链路，并只让目标 NPC 读取已送达摘要 |
| AI-011 | P1 | Open | NPC 历史主张核验需继续提高结构化可靠性 | 已加入每 NPC 独立事实/承诺账本、提示词核验规则和最近对话/摘要隔离；事实从模型结构化输出抽取，仍需长对话对抗样例验证 |
| AI-012 | P1 | Open | 真实模型流式服务偶发不可用 | 2026-08-12 生产构建后 E2E 在聊天阶段返回 `CHAT_STREAM_AI_PROVIDER_ERROR`；需补充供应商错误码记录、重试/降级策略与可观测性，不能把外部失败误判为游戏状态错误。另：所有错误（含规则违规/持久化失败）统一以 HTTP 200 在 SSE 内返回，监控不可见 |
| AI-013 | P0 | Resolved | NPC 正文成功但结构化评分连续失效，玩家无感知 | 已拆为流式角色正文 + 独立低温 JSON 评分；评分携带本轮玩家输入、NPC 实际回复、最近对话和记忆，失败自动重试，再失败走规则兜底。前端逐轮显示变化、原因和兜底标记；强化真实 E2E 连续对话通过 |
| AI-014 | P1 | Open | 客户端可影响会面中“谁先谈工作”的 AI 上下文 | 聊天请求允许提交 `workTopicOpenedBy`，服务端在权威会面字段为空时采用客户端值并传给 NPC 提示词和评分模型；应从服务端对话事件/结构化评估推导，不接受客户端声明 |
| AI-015 | P1 | Open | 长对局复盘只读取最早 80 条消息 | `getSessionTranscript` 按时间升序后直接 `limit(80)`，第 81 条后的关键对话、违规和承诺不会进入复盘；需按摘要+关键事件+末段消息构造完整且受控的复盘上下文 |
| GAME-011 | P0 | Resolved | 大改后模拟时间、预约和AI礼品逻辑存在边界冲突 | 修复等待/赴约占用、迟到、晚间免加班、改期后晚间上限、历史联系人迁移和边界礼品AI覆盖；状态机与真实E2E通过 |
| GAME-012 | P0 | Open | 统一命令接口可绕过建联与跟进前置条件 | `contact` 不校验 NPC 初始渠道或真实回复就设置 `hasReplied=true`；`follow_up` 的 message 分支不要求已建联/已完成拜访，也不核验 `appointmentId`。需统一复用聊天与预约的服务端前置条件并增加越权 API 测试 |
| UX-002 | P1 | Resolved | 对局过程暴露内部态度/支持等评分 | 手机式对局页只以头像、措辞、通知、回复速度和结果反馈；五维、态度、证据、风险仅在结算显示 |
| RANK-001 | P1 | Open | 房间排行榜与结算状态不一致且空榜统计异常 | 对局结算写入 `won/lost`，排行榜仅查询 `status=finished`，因此当前成绩不会出现；空数组仍执行平均值除法和 `Math.max(...[])`，返回 `null`。需统一状态枚举、房间过滤和空集统计 |
| DB-003 | P1 | Open | 结算后读取通知会重写对局完成时间 | 状态机允许结束后执行 `mark_notification_read`，`commit_game_command` 对所有非 playing 状态都设置 `finished_at=now()`；需仅在 playing→won/lost 首次转换时写入完成时间 |
| SCORE-002 | P1 | Blocked | C0 中 A314 引用与括号权重疑似错误 | 检测测试已确认；业务含义需公式负责人确认 |
| ENV-002 | P1 | Resolved | 已采用无需 Docker 的托管 Supabase 流程 | CLI 已安装、项目已关联、迁移已推送且远程查询成功 |
| ENV-005 | P1 | Resolved | Windows 重启后缺少可发现的一键启动入口 | 根目录新增 `start-project.bat`，覆盖配置、依赖、端口和构建检查，启动后自动打开浏览器 |
| GOV-003 | P0 | Open | 7448 行改动与 10 个未跟踪路径（含 3 个迁移文件）尚未提交 | 最后提交 2026-08-12 14:52；迁移文件丢失会让托管库与代码永久不一致。下一步：按工作项分批提交，优先迁移与新增路由 |
| AUTH-002 | P0 | Open | 认证无信任边界，可自封任意角色并接管他人存档 | `select_role` 无凭证签发任意角色 token（login/route.ts:63-89）；token 为无签名 base64（identity.ts:97-105）；18 个路由无 authGuard 且无 middleware.ts；`authGuard` 的 requiredPermission 17 处均未传。RLS 仅 3/17 表收紧，其余 permissive allow-all。下一步：签名校验 + 关闭 select_role + 全路由守卫 |
| GAME-013 | P0 | Open | 全部随机数由客户端 commandId 播种，合规审计与邀约/礼品结果可离线枚举 | `shouldNpcRespond` 为确定性 FNV-1a（state.ts:1048），种子含客户端 commandId（1280/1499-1508/923/1553）。实测 cmd-14 使 10% 邀约通过、gift-36 使 severity-5 礼品躲过全部审计且合规扣分恒 0。下一步：改服务端不可预测种子 |
| AI-016 | P0 | Open | 评分提示词与 Zod schema 多处不一致，是协议失败反复发生的机械原因 | riskReason 必填但提示词未提（ai.ts:55 vs npc-evaluation.ts:90）；dimensionDeltas 需英文 key 但提示词只给中文；semanticFlags 6 布尔未列；长度上限 schema 有提示词无；无 JSON 示例；parseEvaluation 丢弃 parsed.error（:301）。下一步：对齐 schema + 输出示例 + 保留错误 |
| AI-017 | P0 | Open | 玩家文本可注入 system prompt 并绕过隐藏人物解锁门槛 | preparedItems.title 直插 system prompt（customer.ts:80）；key_contact 解锁只靠回复正则、无服务端 support≥50 门槛（state.ts:585/427-430）。下一步：转义/隔离玩家文本 + 服务端复核解锁 |
| AI-018 | P1 | Open | AI 输出未校验即持久化并决定结算/合规 | confirmedFacts/commitments 只去重 slice(-12) 即作为权威 system text（state.ts:588-589）；publicValueEvidence 无过滤；模型 severity 直接 ×3 成合规扣分、disposition 决定 triggered/latent（state.ts:1547-1559）。下一步：确定性校验/来源核对后再入库 |
| GAME-014 | P1 | Open | 模拟时间与合规存在多处边界缺陷 | 17:00 后分钟双重计费（state.ts:662 用 minutes 而非 regularMinutes）；晚间非正式占用白天额度（1214-1215）；18:00 边界可绕过每日一次（1235/1264）；advance_phase 第 5 轮双审计（1156+955）。下一步：逐项修复并补边界回归 |
| SCORE-003 | P1 | Open | 结算证据单句双计分、strength 死代码 | 绩效/个人绩效正则子集使一句同时计入对公+个人两维度（state.ts:591-596）；evidence 声明为 string[] 致 strength 恒 2（ai.ts:96-97），两维度退化为条目数阶梯。下一步：修复正则互斥 + 恢复对象证据强度 |
| BASE-008 | P1 | Open | 10 张幻影表 + 列名不匹配 + 部分路由静默吞错 | API 引用但任何迁移都不存在：game_rooms/game_groups/project_difficulties/competitor_profiles/npc_profiles/scenario_locks/game_initiations/coach_history/enterprise_history/enterprise_customizations；enterprise/players 写不存在的 username 列、coach/players 查不存在的 game_sessions 列；7 个路由吞错返回 200 空数组。下一步：按功能核验建表或删路由 |
| ENV-006 | P1 | Open | 一键启动不检测陈旧构建 | start-project.bat:55-57 只判存在；实测 .next/BUILD_ID 为 8/13、13 个源文件更新至 8/14 12:34，双击会启动过期代码。下一步：按源文件 mtime 判陈旧并强制重建 |
| UX-003 | P1 | Open | 假页面在全局主导航且存在假成功提示 | /room、/knowledge 全静态且在 app-shell 主导航；/home /ranking /coach /enterprise-admin /designer 假数据或 alert 不校验 res.ok。下一步：诚实禁用或摘除导航，后台按 BASE-008 建模 |

## 已知延期

| ID | 优先级 | 状态 | 问题 | 重新进入条件 |
|---|---|---|---|---|
| GAME-004 | P1 | Deferred | 四项目事件和竞品动态不完整 | 项目一闭环稳定后 |
| CONTENT-002 | P1 | Deferred | 完整关卡事件表命名体系未映射 | 项目一稳定 ID 完成后 |
| CONTENT-003 | P2 | Deferred | 素材用途、版本、版权未整理 | 功能闭环后建立资产目录 |
| ADMIN-001 | P1 | Deferred | 企业报告和邀请码 API 缺失 | 项目一闭环后进入后台阶段 |
| ADMIN-002 | P1 | Deferred | 设计师 CRUD 与权限不完整 | 数据模型稳定后 |
| ADMIN-003 | P1 | Deferred | 教练发起、观察、点评、历史不完整 | 单人状态机稳定后 |
| AUTH-001 | P1 | Deferred | 登录、验证码、Token 为演示实现 | 正式上线阶段；当前不可视为安全。严重性已升级：见本期 AUTH-002（无凭证自封任意角色 + 无签名 token） |
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
