# 第二轮：现有UI适配与下拉选择

用户明确首轮三款都不接受。首轮技术通过保留为历史，当前推荐入口必须展示新三款。

## 视觉依据

- 实际当前文件：projects/public/project1-prototype-v9.html，注意文件后部CSS覆盖；正式game-board.module.css作对照。
- 根在隔离Chrome打开当前HTML，fetch全部替换/HTTP拦截，只进入独立本地默认game，捕获screenshots/current-game-reference.png。没有访问真实接口、登录存储或用户对局。
- 沿用当前浅蓝背景、白面板、深蓝标题、蓝色渐变主按钮、浅蓝描边、圆头像、16px圆角与柔和阴影。背景参考图压缩内嵌。
- 三款只比较布局：04标准居中、05紧凑纵向、06左右分栏。所有模板共用templates/04-current-ui.html，body data-layout决定布局。不再另起配色/插画/品牌风格。

## 选择与内容

两个原生select，行业/业务选项由共用资料填充，关联label，先选行业再选业务。菜单有滚动/键盘/移动端原生交互，新增选项不改变页面高度。无平铺行业/业务卡片。8行业6业务12组合只是演示库存，灰色业务仅表示本示例暂无资料。

第二步沿用客户公开项目背景/五人照片姓名职务及可展开技术资料。返回保留有效选择，切换行业清除不兼容业务。开始只到演示完成页，不创建真实对局。完整专业AI底稿与两端产品接入仍待后续实施。

## 文件分工与验证

engine worker仅demo-engine.js/build.cjs；UI worker仅04-current-ui.html；QA worker仅verify-current-ui.cjs；根维护比较入口/台账并实际Review、构建、浏览器和视觉验收。保留其他人的修改。

逐款12组合、初始/联动/返回/详情/五图/完成/焦点/动效、1440×1000/1280×720/390×844、100行业选项扩充、无HTTP与脚本错误；证据verification-current-ui.json与新截图。真实产品服务/数据库/模型/现有存档不在本批范围。
