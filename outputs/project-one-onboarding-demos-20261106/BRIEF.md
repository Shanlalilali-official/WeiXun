# 项目一开场HTML示例制作约定

> 首轮历史约定。用户已否定三种独立视觉与平铺选择；最新要求以BRIEF-CURRENT-UI.md为准，原资料与两步流程继续复用。

用户2026-11-06已批准开始制作示例HTML。本批仅独立本地原型，不修改projects运行代码/数据库/模型配置，不生成真实场景库。所有示例复用同一资料和行为，便于比较视觉；提供可双击打开、无网络依赖的最终HTML。

## 内容

- 两步大弹窗：1选择客户行业+自己公司主营业务，2客户项目简报+五人照片姓名职务。最后“开始训练”只进入明确的演示完成态，不创建真实对局或启动倒计时。
- 8行业、6业务候选，12个适配组合的本地虚构演示资料。主营仅匹配客户需求，不预设我方产品/案例/能力。无匹配组合禁用并清楚解释。
- 默认无选中项，两项选完才可继续；可返回修改，保持有效选择。项目摘要简洁，公开项目信息可展开查看现状/技术条件/实施/验收。只展示公开演示信息，不披露人物诉求/偏好/隐藏指标。
- 五人使用现有照片/姓名，按行业示例映射职务，人物卡不增加详细简介。所有技术数据/公司均标为演示虚构，不冒称已从DB匹配或AI生成完成。
- 20:00仅作正式训练时长提示，阅读不计时。支持键盘、focus、aria、移动端、减少动效开关及prefers-reduced-motion。

## 分工

- engine worker：source/demo-data.js、source/demo-engine.js、build.cjs；统一数据/交互、照片优化内嵌及生成脚本。不得写3份模板。
- theme A worker：仅templates/01-briefing.html，深蓝作战简报。
- theme B worker：仅templates/02-workspace.html，浅色商务工作台。
- theme C worker：仅templates/03-industry.html，青绿/暖白行业场景。
- root：台账、比较入口、浏览器验收/截图和最终交付。所有人保留他人修改，不写正式项目。

最终文件名：01-作战简报.html、02-商务工作台.html、03-行业场景.html。build从模板内两个标记注入数据与引擎：`<!--DEMO_DATA-->`、`<!--DEMO_ENGINE-->`。最终不得依赖本地服务/外部JS/CSS/字体或网络图片。照片源位于projects/public/assets/people/*.png；仅优化尺寸/压缩后以data URI内嵌，不改变人物形象。

## 模板/引擎统一DOM契约

- 根`[data-demo-dialog]` role=dialog aria-modal=true，`[data-step-indicator="select"]` / `[data-step-indicator="brief"]`步进；`[data-motion-toggle]` button通过aria-pressed切换。
- 三个section：`[data-step="select"]`初始显示，`[data-step="brief"]`和`[data-step="ready"]`初始hidden。CSS必须`[hidden]{display:none!important}`。各section一个`[data-screen-title]`标题tabindex=-1供焦点定位。
- select：`[data-industry-grid]`、`[data-business-grid]`，`[data-selection-summary]`带role=status/aria-live=polite，`[data-continue]`初始disabled。
- brief：`[data-project-name]`（可同时为标题）、`[data-client-name]`、`[data-industry-label]`、`[data-business-label]`、`[data-project-description]`、`[data-brief-facts]`、`[data-project-overview]`、`[data-people-grid]`。
- brief详情：`[data-open-details]` button aria-expanded=false，`[data-details-panel]`初始hidden。主题可用自己的包裹布局，engine插入内部内容。
- brief footer：`[data-back]`、`[data-start]`。
- ready：说明“本页为开场演示，不会创建真实对局”，`[data-review]`返回brief、`[data-restart]`返回select保留当前选择。
- 可选`[data-current-step]`显示“01 / 02”等，由engine更新；`[data-demo-badge]`标演示。风格之间导航可放dialog header中，用最终文件名链接。

## 引擎插入元素样式契约

- 行业/业务按钮：`.choice-card`（button type=button，data-industry=ID或data-business=ID，aria-pressed），内部`.choice-icon`（SVG）、`.choice-copy`含`.choice-title`和`.choice-desc`，`.choice-check`。选中`.is-selected`，禁用按钮属性disabled；引擎同时更新[data-business-grid] aria-label/提示。
- 事实卡：`.fact-card`含`.fact-label`/`.fact-value`/`.fact-note`。
- 概况：`.overview-copy`文字及`.goal-chips`中`.goal-chip`。
- 人物卡：`.person-card`含`img.person-photo`、`.person-name`、`.person-role`；照片加载首屏即可，不用联网。
- 公开详情：`.detail-section`含h3和`.detail-table`（dl或table均可，由engine统一生成，主题需兼容dl/dt/dd），内容包含现状、技术需求、实施、验收。
- 主题可添加自己的装饰/封面/侧栏/编号，但不可更改数据、行为或真实业务规则。三份布局与气质应有实质差异，不只是换色。使用中文系统字体栈即可。

## 验证

root将用真实Chromium file://离线打开，覆盖初始、选择、切换无效组合、两步、公开详情、五人图片、返回/重新选择、完成态、键盘/减少动效、1440×1000及390×844视口、控制台/网络错误。截图用于选择风格，不冒称真实游戏或数据库联调。
