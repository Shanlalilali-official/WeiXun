# 工作交接

## 当前交接点

Windows 人工验收可直接双击仓库根目录 `start-project.bat`；服务以前台窗口运行，关闭窗口即停止。默认尝试 `http://127.0.0.1:5000/`，若被旧服务占用会自动使用后续空闲端口并打开实际地址。

项目已脱离 Coze 运行时。应用使用标准 Node/Next.js、通用 OpenAI 兼容 AI Provider 和托管 Supabase。项目一现为五个模拟工作日：手机联系人、线上建联、邀约/改期、准备、5/40/60分钟拜访、纪要/跟进、AI态度/礼品风险、混合结算均已完成并通过真实模型E2E与生产构建。

隐藏人物不能再由亲密度直接解锁：亲密度达到 50 只开放披露资格，AI 正文明确出现“业务部部长陈建国”后才写入 `key_contact` 并显示节点。不要恢复旧的亲密度直接解锁逻辑。

2026-08-14 完成一次全量审计（AI / API / 状态机 / 前端），发现 P0 阻断项：认证无边界（AUTH-002）、随机数可被客户端枚举（GAME-013）、评分提示词与 schema 不一致（AI-016）、玩家文本可注入提示并绕过解锁（AI-017）、未提交改动含 3 个迁移（GOV-003）。完整清单与证据见 `harness/issues/ISSUE_REGISTER.md`。其中 GOV-003、AUTH-002、BASE-008、BASE-007 已于 2026-08-14 修复（HMAC 签名 token + 路由守卫 + 501 降级 + lint 清零）；剩余 GAME-013/AI-016/AI-017 为游戏逻辑，待业务侧迭代。

## 下一位执行者

1. 阅读 `harness/STATE.md` 和 `harness/issues/ISSUE_REGISTER.md`。
2. 双击 `start-project.bat` 启动人工验收环境；无需 Docker。启动器会检查数据库、自动重建陈旧产物，并通过构建号健康检查避免复用旧服务（ENV-006 已解决）。
3. 开发前运行 `projects/scripts/check-local-env.ts` 对应的 `pnpm local:check`，不得输出或提交密钥。
4. 项目级 P0 已修复（GOV-003/AUTH-002/BASE-008/BASE-007）。剩余为游戏/AI 逻辑 P0：随机数改服务端种子（GAME-013）、对齐评分提示词与 schema（AI-016）、封堵提示注入与解锁绕过（AI-017），需业务侧确认后修。随后处理 AI-005、GAME-003 的长对话/语义验收与头像替换；DB-002 已解决。
5. 更新所有问题状态与证据；不删除问题历史。

## 安全与约束

- 不提交 `.env.local`、模型 key 或 service_role key。
- 不把外部素材库整体复制进 Git。
- 不为测试放宽运行状态表的 RLS。
- 聊天正文、评分、记忆、资源、事件与命令幂等已由 `commit_game_command` 原子提交；不要恢复旧的多次写入路径。
- 会话 token 已改 HMAC-SHA256 签名；不要恢复无签名 base64 兜底或 select_role 无凭证签发。
- C0 公式只能由业务负责人确认后修改。
