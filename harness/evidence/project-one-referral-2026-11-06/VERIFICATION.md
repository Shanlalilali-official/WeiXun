# 王德福外部引荐：实现与验证（2026-11-06）

用户批准上轮方案，要求实际测试与玩家端一致；随后明确：**发送沿用原成本，邀约不额外扣点**。本轮已本地完成；未启动服务、远程部署或修改真实存档/后台配置。

## 最终行为

- 正式 `/game` 与设计师“实际测试” `/project-one-preview` → `public/project1-prototype-v9.html` 都只在王德福处显示“通过引荐联系”。介绍人不建NPC、不显示姓名。
- `use_referral` 由权威会话保存 `referrals['P1-003']`，旧档缺失为空；只有合法服务器记录才显示完成。登记不扣点、不伪造NPC已回复、不加支持/愉悦/线索。
- 两端共用 `external-referral.ts` 资格规则、记录schema与费用记录；已引荐后工作微信确定接受，普通有效拜访邀约确定接受。正式真实聊天入口也跳过这条路径的AI拒答；正常后续王德福对话获得不含介绍人身份的安全事实。
- 预约安排复用正式 `resolveInvitationPayload`，测试端按同一时间、地点、议题投影；已有同目标accepted预约沿用原安排，不声称已改新时间，不重复创建/收费。原准备和实际拜访仍需完成。
- 微信邀请、内部会议通知、历史记录、取消、活动提议及红线不进入确定性拜访接受；预览即使收到错误AI accepted/草稿也不能落非法预约。未添加微信/未接通电话的本地测试覆盖不能冒充新路径的有效服务端渠道。
- 低AP时 `reuseOnly` 请求只能复用权威已接受预约，失败在AI/提交前拒绝；不会把普通消息免费执行。

## 费用说明

不是新增邀约费。登记引荐0，邀约动作额外0；邮件/微信原发送成本1，附件原成本另1，已接通电话内邀约0额外成本；已有预约复用0。微信申请原成本仍1。

正式AP原子扣除与新 `chargedActionPoints` 累计一同提交；预览只对本引荐建联/确定邀约发送路径记录实际原成本，客户端按账号状态、会话和引荐ID保存结算水位，与AP/累计花费同一次save。首次成功也走同一对账，丢包后恢复补记一次，迟到/重放低总额不退款，重复不双扣。旧记录缺累计字段默认0，不补造历史费用。其他非引荐预览AP/计时机制不做全局重构。

## 主线程独立验证

均已通过：

- `test-formal-external-referral.ts`：核心/正式状态、旧档、0成本登记、微信与邀约、重放/新ID复用、电话0增量、正式聊天入口契约。
- `test-preview-external-referral.ts`：真实service及executePersistent的JSON/租约适配测试、AI不可用的正向路径、恶意AI误判不落预约、渠道、reuseOnly与费用。
- `test-external-referral-parity.ts`：同一旅程两端对照，包括15:00/地点/议题、累计原发送成本、0AP复用、账号与会话隔离。
- `test-external-referral-ui.ts`：执行真实HTML脚本的VM；入口、失败、200缺授权拒绝、刷新/账号清理、丢包恢复单次对账、重放不退款。最终0AP用例使用正常DOM输入和无参sendMessage，断言POST确增1及reuseOnly=true，消除早期提前返回的假阳性。
- 现有：formal-five-person、formal-workflow-state、project-one-preview-ai、preview-customer-activities、formal-customer-activities、five-stage-state、invitation-intent、review-context、preview-account-isolation、preview-recovery-ui、customer-activity-quiz-ui、metrics、project-one-entry-info。
- AI provider普通/流式回归：仅本机mock HTTP，无真实模型调用。
- 最终TypeScript、完整ESLint、最后UI脚本定向ESLint、最终Next production build及tsup服务端打包。
- `git diff --check`、`scripts/harness-check.ps1`；实际改动与台账双向复核。

独立只读Review曾发现资格误判、模型回退写预约、0AP/丢包费用、UI假阳性/错误toast，均修后复测；最后独立重跑UI专项并确认无剩余本批P1/P2。初期Luna按文件分工，复杂完整性修复升级Terra；主线程复核实际diff并再运行最终检查。

## 保留的已知边界

- `test-preview-test-controls.ts:255` 本轮再跑仍为已有支持度快照断言 `0 !== 21`，P1-TEST-003保持Open。上轮在撤掉职务/标识渲染的内存反证中也复现；本轮未扩为无关测试控制面板修复。不声称全套测试全部通过。
- 没有真实浏览器完整登录态对局、真实AI/远程数据库联调；UI采用VM，持久路径采用JSON/命令租约适配器，不冒称远程DB实测。现有simulation_state/preview JSON支持扩展，未新增SQL迁移。
- 保留原有quiz/报告规范等未提交修改，不提交或推送Git。PATH pnpm11不符合项目要求，依LOCAL_DEVELOPMENT使用已有node_modules二进制，不安装/升级依赖。Next/Tsup与mock HTTP检查在沙箱外执行以避免已证的沙箱子进程/loopback限制。

重新启动项目并刷新玩家/实际测试页面后使用本轮构建。
