# 连续活动同步失败与恢复

日期：2026-11-02。用户截图：第二个pending活动2/2显示“活动状态同步失败”。未取得截图时刻浏览器请求/服务端日志；本地*.log均8月旧记录，不能断言实际故障一定是409。

实际检查public/project1-prototype-v9.html的apiCall/accountScopedApiCall/customerActivityRequest/refreshCustomerActivityQueue与recoverPreviewSession，服务端execute/executePersistent和GET handler。同步仍使用版本CAS，可产生409；apiCall返回null后原上层泛化错误，pending/planning无弹窗重试，同key快速返回不能清旧错误DOM。

修复：保留本次具体错误，失效请求按原身份隔离退出；同步409有界调用一次既有GET恢复，成功后清错误，失败保留恢复错误。pending/planning提供重试同步，未ready时禁用start/submit。error加入渲染key，各retry控件在busy结束同key路径恢复，防止重试继续灰。旧会话和dirty草稿保留，不自动重建或重放start/answer/complete等写命令。GET沿原合法恢复/到期结算路径，不宣称完全无状态变化。

主线程实际diff审查并独立通过6项专项：test-customer-activity-quiz-ui（二活动409恢复仅一次GET、第二活动start、503后实际点击retry成功/清旧错/不残灰、planning草稿保留）、test-preview-recovery-ui（恢复GET失败后项目入口可再次恢复，不重放POST）、test-preview-countdown、test-preview-account-isolation、test-preview-customer-activities、test-customer-activity-neutral-ui。tsc、Next生产构建、tsup通过；完整lint（--quiet）exit 0、harness与diffcheck通过。

没有改触发门槛、题目、LLM/Jev选择或NPC数值规则。未真实模型/数据库/浏览器联调，未重启服务、部署、提交或推送Git。
