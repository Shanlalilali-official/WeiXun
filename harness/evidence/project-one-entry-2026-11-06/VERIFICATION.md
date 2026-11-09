# 项目一入场信息验证（2026-11-06）

用户最终语义：五人开局直接展示职务，其余信息按旧方式搜集；王德福可由系统外的人引荐认识，介绍人不需在系统出现。标识和说明已完成，完整引荐授权/微信/邀约状态流仍为探索建议，未伪造已添加或预约状态。

## 实际修改与复核

- 正式 `src/app/game/page.tsx` 人物卡/详情展示title，只有P1-003显示“可引荐”，说明为“可通过他人引荐认识王德福，添加微信并邀约拜访”；CSS仅增加badge。
- 测试iframe实际加载的 `public/project1-prototype-v9.html` 同步。HTML与TS五人facts仅去掉本人职务前缀，职责、汇报关系、其余事实/线索保留；初始publicResearch未免费增加，原2AP不变。
- 主线程检查两Worker实际diff、身份/方向/字段与原有quiz修改是否冲突；最终保留用户此前所有未提交变更，不改真实存档、后台配置、提示词或模型设置，不重启服务、提交或推送。
- `plans/PROJECT_ONE_REFERRAL_EXPLORATION.md` 已按用户纠正重写为external→P1-003，介绍人无NPC实体。现有NPC向外转介配置未误作本轮路径。

## 主线程独立验证

通过：

- `node harness/evidence/project-one-entry-2026-11-06/ui-verification.cjs`：执行真实HTML内联脚本并渲染5人卡片/详情，title开局可见、仅王德福标识、外部引荐方向及用途文字正确。
- `test-project-one-entry-info.ts`：5人title/facts同源，职责保留，开局无已收集资料；真实state搜索王德福保存事实且扣2AP。
- `test-formal-five-person.ts`、`test-formal-workflow-state.ts`、`test-project-one-preview-ai.ts`、`test-customer-activity-quiz-ui.ts`。
- `test-five-stage-state.ts`、`test-metrics.ts`、`test-ai-provider.ts`（本机mock）。
- 最终 `tsc -p tsconfig.json`、最终 Next production build、tsup服务端打包。
- 最终稳定文件的全量ESLint `node node_modules/eslint/bin/eslint.js . --quiet` exit0；Worker定向lint零错误，有既存Hook依赖warning，不将warning写作新增修复。
- `scripts/harness-check.ps1` 与 `git diff --check` 通过，台账与实际改动双向核对。

环境：PATH pnpm为11.25，项目要求9；Corepack9缓存缺失且禁止联网，未安装/改依赖，按LOCAL_DEVELOPMENT既有规定用node_modules本地脚本。沙箱Next初次因CSS子进程连接失败panic；沙箱外同命令及用户纠正后的最终重建均成功。AI provider沙箱内无法连mock，沙箱外同测试通过，不调用真实模型。用户纠正期间一次全量lint读到UI编辑中间语法错误，随后最终tsc/build通过并对稳定文件重新全量lint。

## 既有回归缺口

`test-preview-test-controls.ts` 第255行失败：期望消息后张建国support=21，实际0。本批不改API响应/快照行为；主线程用 `reproduce-existing-test-failure.cjs` 将本批两处联系人渲染函数在内存恢复为HEAD版本（保留之前的quiz/恢复修改），同一断言仍失败，反证失败不依赖本批职务/标识。没有改产品状态来迎合测试，也未覆盖此前修改。新问题P1-TEST-003记录后续调查；不将全套回归说成全部通过。

未做真实浏览器登录态完整对局、真实AI/远程DB联调或部署；VM渲染和本地构建不等于这类验收。
