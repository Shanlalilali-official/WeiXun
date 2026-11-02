# 设计师活动问答与AI规则配置

日期：2026-11-02。本地实现与离线验证。

## 实际入口和配置

- 设计师 `/designer/customer-activities` 延续现有版本保存，增加“匹配门槛 / 情境问答 / AI 评价与结算”三个页签，首页入口说明已更新。
- 问答编辑覆盖四活动各三题四选项、题干/选项文本/支持与愉悦变化，另有饭局无酒精替代题启用及编辑。时限整数30..600秒，玩家两端从quiz startedAt/deadlineAt显示实际时限。
- AI业务评价说明可编辑，最多8000字；AI及最终支持/愉悦/五维范围只能收紧现有硬范围。方案/问答权重0..1、最多两位小数、不能同时为0；先加权求和，按对称四舍五入、限幅，最终只应用一次。空白方案保留原准备不足惩罚，权重或范围不能取消。
- 硬系统JSON契约、玩家输入不可信边界及服务端校验仍在代码中；可编辑业务说明不会替换它们。模型只评文字方案，不接收题库评分或答案重复打分。
- 复用 `/api/designer/customer-activities` 的工作流编辑权限与 `designer_prompt_configs` 的customer-activities行及CAS revision；扩展可选execution。请求上限128000字符，非法字段/越界/空文本/双零权重/保留对象属性题目标识均拒绝。
- 旧存储缺execution时读取默认；旧客户端仅提交mode/thresholds时仓储读取并保留已存execution，再按同版本CAS写入；显式非法execution不默认回退。无需新表或迁移。
- 活动decisionConfig在对话结束匹配时冻结全套execution；quiz创建、AI评价、加权合并及终局SQL形状恢复均读取task快照，后续设计师保存不影响已匹配/进行中活动。题目快照和公开DTO保持只含玩家所需文字/答案/时间，无内部评分或规则配置。

## 主线程验证

以下测试由主线程实际执行通过：

- `test-customer-activity-execution-config.ts`：默认值与深拷贝、时限/题数/选项/ID/权重/范围校验、显式null拒绝、保留ID拒绝和合法自定义ID实际生成quiz。
- `test-designer-customer-activity-config.ts`：完整execution保存与读回、调用方修改不污染存储、旧客户端保留规则、版本冲突、非法存储失败、未登录/非设计师权限以及非法请求在持久化前拒绝。存储为注入的替身，不是真实DB写入。
- `test-customer-activity-plan-ai.ts`：自定义业务说明和范围进入实际evaluator prompt，合法AI返回值按冻结范围裁剪；原正/负/0、异常/非法输出、空白与输入隔离回归保持。
- `test-customer-activity-execution-ui.ts`：实际form parser保留/拒绝配置；真实React editor SSR验证三题字段、控制项及禁用状态，空数值NaN阻止保存；同页提交完整execution与匹配推荐不丢规则的契约。
- `test-customer-activity-quiz.ts`、`test-customer-activities.ts`：自定义题库/时限/替代题、固定快照、权重/限幅/舍入、全零范围与planWeight0仍保留空稿负向、旧配置兼容。
- `test-preview-customer-activities.ts`、`test-formal-customer-activities.ts`：自定义题目/90秒、AI业务指引快照、权重与数值总量实际应用目标NPC、后续配置修改不漂移、终局SQL形状按原配置恢复、旧配置与公开隐私。
- `test-customer-activity-decision-form.ts`、`test-customer-activity-quiz-ui.ts`、`test-preview-countdown.ts`、`test-preview-recovery-ui.ts`通过。
- 最终TypeScript、完整ESLint、Next production build、tsup打包、diff --check、harness-check通过。使用现有node_modules工具；完整lint/Next在受限环境外执行，未安装依赖。

独立高风险Review发现合法配置题目ID为`__proto__`时导致答案字典校验失败的P2；已在schema拒绝`__proto__`/`constructor`/`prototype`并补配置到quiz生成回归，定向复核已关闭。未发现其他有证据的P1/P2。

## 边界

没有读取/写入真实配置行、真实存档、调用真实付费模型、迁移数据库、启动或重启服务、远程部署或Git提交。没有真实浏览器视觉/保存端到端验收；React SSR、HTML VM和服务注入测试不能冒称真实联调。代码已接现有配置表与鉴权API，但不声称远程当前配置已被更新。上一轮活动问答未提交实现完整保留。
