# 答题全灰复发：后台同步长期等待

日期：2026-11-03。用户再次截图，随后明确已关闭服务。本批保持服务关闭；可访问浏览器库存没有游戏页面，未实查截图当时的请求，不宣称真实浏览器或模型/数据库联调。

实查与旧覆盖缺口：public/project1-prototype-v9.html在answering每2.5秒发customer_activity_sync POST，focus/pageshow/visibility/boot也会发同步；requestBusy与syncBusy令fieldset和四选项禁用。fetch未设超时，前次019/020只证明finally结束后恢复，未证明慢请求期间可用。新VM先推进2.501秒运行真实clock，以旧代码发现多发sync而失败，再以deferred/hang AbortSignal模拟长期请求。

方案：答题阶段统一跳过自动sync（包括各窗口事件入口），答案POST仍返回权威题目状态；用户显式重试可恢复，到期complete仍以服务端截止/幂等校验为准。不伪清busy、不并发绕过版本CAS。活动POST通常30秒、complete_quiz180秒，preview恢复GET30秒；finally清timer与busy。超时不意味着服务端回滚，写超时使恢复key失效，用户重试先GET核对答案/quiz，已保存则不重复POST，未保存才显式重试。恢复失败在活动弹窗可见，成功只清匹配的恢复错误，不覆盖其它答案错误。

根实际diff复核并独立验证通过：test-customer-activity-quiz-ui、test-preview-recovery-ui、test-preview-countdown、test-preview-account-isolation、test-preview-customer-activities、test-customer-activity-neutral-ui；WEIXUN_REPRODUCE_QUIZ_SYNC_LOCK=1内存反证通过。tsc、完整ESLint --quiet、最后两项改动脚本定向lint、最终Next生产构建和tsup通过。根审查另修retry generation漏声明与恢复错误捕获时间；account-isolation旧fake timer无论delay都立即回调，现对长请求timeout不即时触发，其超时语义在quiz专项单独控制。未安装依赖、重启服务、清空真实存档、提交或推送Git。本地代码修复需重新启动服务并刷新页面后才能用于实际操作。
