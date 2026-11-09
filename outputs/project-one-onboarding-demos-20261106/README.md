# 项目一开场 · 现有UI下拉版（第二轮）

最新版本：配图已换为写实照片并保持静止；仅logo开场图形播放一次1.2秒，无加载或等待。所有非公开与待确认信息不再嵌入HTML，完整底稿仅保留source。原图/提示词为assets/onboarding-hero-photo-v2.png与IMAGE-PROMPT-PHOTO-V2.md；最新证据VERIFICATION-PHOTO-PUBLIC.md。下方插画/浮动说明为历史。

最新增强：用户认可现有UI与下拉方向，欢迎区已加入内置image_gen生成的蓝白客户沟通插画、细渐变描边/柔光和轻入场/图片浮动；减少动效开关及系统偏好均可关闭。原图与生成提示词见`assets/onboarding-hero-ai.png`、`assets/IMAGE-PROMPT.md`，构建内嵌WebP约65KB，不依赖外网。最新验收见`VERIFICATION-ILLUSTRATED.md`。

双击 `index.html` 比较，或单独打开：

1. `04-现有UI-标准弹窗.html`：沿用现有UI，两个下拉菜单并排。
2. `05-现有UI-紧凑弹窗.html`：沿用现有UI，两个下拉菜单纵向排列。
3. `06-现有UI-分栏弹窗.html`：沿用现有UI，左侧介绍、右侧下拉选择。

三份采用当前游戏的浅蓝白色面板、深蓝标题、蓝色主按钮和圆头像。背景为隔离渲染的当前游戏静态参考图，不是正在运行的对局。首轮01–03与index-first-round.html仅保留历史，用户已否定，当前index入口仅展示第二轮。

每份HTML均内嵌照片、背景、样式、资料与交互，可独立复制、离线打开。先从下拉菜单选“制造业”及“企业管理与协同软件”，再查看客户背景、人物照片和可展开的公开技术资料。也可尝试其他行业/业务、返回修改，或在窄屏查看。原生菜单支持长目录滚动、键盘和移动端选择；灰色业务仅表示本示例暂无资料。

这是供视觉与交互选择的示例：8个行业、6类业务候选、12个适配组合，尚未冻结最终目录。客户名称、项目及技术数据为虚构演示，未调用真实AI或匹配数据库。主营业务仅匹配客户需求；我方能力由玩家结合真实公司判断。技术预览只展示公开需求，后续沟通仍需收集和核实更多信息。

点击“开始训练”进入演示完成页；不会创建真实对局。正式玩家端和实际测试端本批均未改动，选定后再按同一场景源接入。

完整输出目录的制作文件在`templates/`和`source/`。`node build.cjs`构建六个独立HTML（含历史版），`node verify-current-ui.cjs`用本机Chrome验证第二轮三款，`node make-gallery.cjs`生成新版比较入口与联系图。压缩包仅包含第二轮四份HTML和本说明，源码与验收资料保留在原输出目录。构建/验收脚本使用当前机器已安装的Playwright/Sharp，不是最终HTML的运行依赖。最新验收结果见`verification-current-ui.json`与`VERIFICATION-CURRENT-UI.md`；首轮verification.json只作历史。
