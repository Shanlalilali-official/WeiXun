# 问答解灰与中性评估界面

日期：2026-11-02；本地修复，未重启服务或部署，未真实浏览器/模型/数据库联调。

HTML后台同步在requestBusy期间应用响应并渲染问答禁用态，清busy后相同task key快路径未重算fieldset/选项/导航。新增统一控件状态同步，在busy变更、同key快路径和问答渲染时执行，保留真实请求/截止禁用。根另以WEIXUN_REPRODUCE_STALE_QUIZ_BUSY=1在内存删除解锁调用，确实复现requestBusy=false但fieldset/选项仍disabled（未覆盖HTML）。完整脚本VM用deferred fetch验证同步中禁用、响应与两个finally结束后恢复，答案/task key保持不变，并实际点击保存选项。

正式React和HTML预览均在complete_quiz请求开始进入三环旋转评估态；该请求会等待AI，不能仅按server quiz.completed切换。快速结果至少显示900ms动效；服务端尚无evaluation则持续等待，可重试，不按计时伪造完成。失败返回题页并保留重试数据。减弱动态偏好关闭动画。

完成状态固定“评估已结束，请您继续开展您的销售工作”，中性颜色，不渲染旧overallEvaluation内容。共享公开投影对正向、负向、零变化、混合及空稿均使用同句；私有评价、NPC数值、问答权重、幂等与LLM/Jev选择保持。实际数值变化和失败不改分在两端集成测试继续验证。

根实际diff审查并独立验证通过：test-customer-activity-neutral-ui、test-customer-activity-quiz-ui、test-preview-countdown、test-preview-recovery-ui、test-customer-activities、test-customer-activity-plan-ai、test-customer-activity-plan-jev、test-preview-customer-activities、test-formal-customer-activities。最终tsc、完整ESLint、Next生产构建与tsup服务端打包通过。HTML最后中性样式/标题/CTA小改后VM专项再次通过。使用现有node_modules工具，未安装依赖、提交或推送Git。
