# 活动情境问答与AI方案数值影响

日期：2026-11-02。本地实现与离线验证，未进行真实AI/DB/浏览器联调或远程部署。

## 实现事实

- 原已有 `evaluateCustomerActivityPlan` 的真实模型调用和结构化数值输出，本次强化按目标职责、需求、方案可执行性、证据、偏好与跟进判断支持/愉悦/五维，可正向、零或负向。方案作为不可信数据序列化，不把玩家要求加分当系统指令。
- 新 `src/lib/game/customer-activity-quiz.ts` 为四类活动提供各三题、四选项、独立120秒的假设推演；固定规则仅在服务端，选项显示顺序按任务稳定洗牌，保存快照后刷新不换题。饭局方案含无酒精/不饮酒等安排时切换现场情境。题库首版采用可信模板及方案条件适配，未实现AI自由编题。
- `customer-activities.ts` 新任务启用quiz，旧pending在新版开始时启用；旧进行中的planning和已submitted不强加新题或重算。方案提交后锁定，答案自动保存，可跳过，截止后锁答案并完成；房间结束立即跳过未完成题。
- `recordCustomerActivityEvaluation` 在quiz完成前拒绝评分，完成后统一合并AI方案值和选项规则值，支持限制[-5,4]、愉悦[-8,6]、五维保持原[-3,3]。空方案沿原准备不足结果，不让题目正向抵消；内部保存aiPlan/quiz拆分。正式state及preview实际应用合并后的evaluation，标记和数值同一状态提交，仅目标NPC与原五维受影响。
- `contracts/game.ts`、preview契约、正式API和两端服务加入answer/complete_quiz动作，校验任务/问题/选项、身份、版本和截止时间。模型失败不制造分值，保持待评价可重试；已入账不重复评价或应用。公开DTO不含题库delta、AI/题目评分拆分、关系快照或门槛。
- React planner与预览HTML实现逐题选择/上一题/跳过/提交、倒计时及保存失败重试。未保存选择时锁住导航，最终提交前确认服务端答案，刷新恢复已保存答案；已完成旧结果兼容。
- 问答期间暂停游戏时间，不扣AP。离线跨规划与问答两截止时恢复锚点取quiz.completedAt，避免把问答两分钟补扣；正式终局房间只在有活动窗口时执行收尾，避免空轮询重复写版本。
- 实查本地 `20261020000100_pause_multiplayer_timer_for_customer_activity.sql` 会直接把规划任务改submitted而无quiz。新增窄兼容：仅终局多人且lastAction=multiplayer_room_ended、quizEnabled且room_ended/timeout、无quiz且未评价的有效任务，读取时合成立即completed的空答quiz；普通playing形态仍严格拒绝，不改旧无quizEnabled任务。未向数据库推迁移。

## 主线程验证

以下专项均由主线程实际运行通过（注入的AI输出/存储验证逻辑及数值传播，不证明真实模型评价质量）：

- `test-customer-activities.ts`、`test-customer-activity-quiz.ts`：状态转换/不提前结算/固定选项与限幅/空稿/截止/房间结束/旧任务升级与兼容/隐私。
- `test-customer-activity-plan-ai.ts`：四活动正向/负向/零AI值传播、非法/越界输出拒绝、模型异常不造分、空白原处理与不可信方案隔离。
- `test-preview-customer-activities.ts`、`test-formal-customer-activities.ts`：真实业务函数和持久化重载、交卷前AI调用0/不改数值、问答后非零AI+选项合并值实际入目标NPC、其他NPC不变、重复完成只结算一次、AP/计时、双截止、SQL终局形状窄恢复。
- `test-customer-activity-quiz-ui.ts`：运行实际HTML脚本的VM回归，包括逐题/高亮/保存失败/导航锁定/重试/刷新/截止/旧结果/不展示分值。
- `test-preview-countdown.ts`、`test-preview-recovery-ui.ts`、`test-five-stage-state.ts`、`test-metrics.ts`、`test-customer-activity-semantic-diagnostics.ts`、`test-designer-customer-activity-config.ts`、`test-customer-activity-decision-form.ts`、`test-project-one-preview-ai.ts`、`test-invitation-intent.ts`通过。
- AI Provider普通/流式专项使用本地127.0.0.1模拟服务；沙箱内连接失败，在受限环境外重跑通过，不访问真实Provider。
- 最终TypeScript、完整ESLint、Next production build、tsup服务端打包、diff --check及harness-check通过。沙箱内lint/build长时间无输出已中止，Next遗留锁释放后在受限环境外完成检查；不将中止批记为通过。

独立高风险Review发现并修复room-end引用比较导致重复CAS的P2；定向复核和SQL兼容复核无剩余P1/P2。

## 未执行

没有启动/重启运行服务、改写真实存档/配置、真实付费模型评价、真实多人房间终局/浏览器视觉验收、数据库迁移、远程部署或Git提交。现有SQL兼容由实际迁移源码与SQL形状离线fixture验证，不声称已实查线上SQL版本。正式既有活动结果确认后的计时一致性问题仍属于原ACTIVITY-TIMER-012范围，不将本次问答暂停验收扩为已解决全部正式弹窗计时。
