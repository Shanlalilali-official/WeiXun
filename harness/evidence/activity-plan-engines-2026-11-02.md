# 活动方案评价 LLM / Jev 切换

日期：2026-11-02。本地实现，未真实模型/数据库/浏览器联调或部署。

原方案评价直接invokeLLM，活动可行性才用既有决策路由。本批新增execution.evaluationProvider独立llm/jev选择，旧配置和默认值为llm，随task.decisionConfig冻结；后台AI评价页保存且保留其余题库/范围/权重，旧门槛客户端写入保留该选择。通用Jev设置页说明其控制下方通用决策，方案另行配置，避免“全部决策”文案误导。

LLM保持原请求/结构化校验。Jev直接使用既有服务端invokeJev，不经过受全局供应商开关影响的invokeConfiguredJev；preview增加activityPlanJevInvoker专用raw依赖。一次请求七个choice问题，分别对应支持、愉悦与五维。请求使用完整硬整数范围，确保设计师全零范围时仍满足Jev至少两个候选的约束；说明本次配置范围，返回后共用限幅。结果用validateJevResponse检查完整问题、类型、候选、概率与confidence，再验证规范整数字符串和原evaluation schema。不读问答分值/权重，不重复计分；不额外调用LLM写评语。

Jev异常/缺key/缺项/非法答案保留待评价，不生成分值、不应用NPC变化、不静默切LLM。空白方案原确定性负向，不调用任一引擎。真实写入仍原一次性合并结算。

主线程实际验证通过：

- test-customer-activity-plan-ai.ts、test-customer-activity-plan-jev.ts：旧默认LLM、两分支调用隔离、7项规范整数/完整响应验证、负零/边界/缩小或全零范围、NaN/错type/缺项/额外答案/非规范key拒绝、Jev异常无fallback、空白不调用。
- test-preview-customer-activities.ts、test-formal-customer-activities.ts：交卷前0评价调用、完成后Jev一次、AI与问答加权值实际应用目标NPC、重复幂等、失败不改分、旧缺字段LLM、后台后来切LLM不改旧Jev活动。
- execution config/UI SSR、designer repository/API、原quiz/core/UI专项通过。Jev Provider本地HTTP模拟及既有Jev designer config回归通过（仅127.0.0.1，不连接真实服务）。
- 根实际diff审查、最终tsc、完整ESLint、Next production build、tsup打包通过；配置/存档未写入真实数据库。后续用户又提出问答解灰及中性评估动效，新UI批次见ACTIVITY-UI-019，需另行完成最终验证。

未改全局供应商选择，未改变触发门槛，未重启服务、迁移、部署或Git提交。真实Jev凭据/模型质量未实查，不以模拟契约测试证明外部模型评价质量。
