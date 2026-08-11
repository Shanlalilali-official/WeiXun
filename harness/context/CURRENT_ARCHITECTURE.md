# 当前架构

## 应用

- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Supabase + Drizzle ORM
- `coze-coding-dev-sdk` 调用豆包模型

## AI调用

```text
Browser
→ Next.js API Route
→ src/lib/ai/client.ts
→ LLMClient.invoke/stream
→ Coze-managed model runtime
```

NPC 对话请求现已统一为 `gameSessionId + scenarioId + npcId + history`。API 校验应用会话，从服务端 `npc_profiles` 加载画像并注入提示词。正文通过 SSE 增量返回；模型尾部的分数、亲密度、线索和情绪使用共享 Zod 契约校验，校验失败时不更新游戏状态。

浏览器现在只发送本轮`message`，服务端根据应用身份加载所属`gameSessionId`，再按`npcId`读取最近12条消息和滚动摘要。每个NPC的消息、摘要、关系值和解锁状态互相隔离。达到16条未摘要消息时压缩旧消息并保留最近8条；模型调用设置输出Token上限。

项目一权威状态保存在`game_runtime_states`，动作与关键转换写入`game_events`，对话写入`chat_messages`。所有修改使用版本号做乐观并发检查。远程迁移尚未应用，因此代码路径已完成但端到端验证处于阻塞。

场景生成前后端已统一为 `industry + productCategory + customRequirement` 请求和 `{ success, scenario }` 响应，且AI JSON必须通过共享契约。

## 目标架构原则

- 服务端 `gameSessionId + npcId` 是会话和游戏状态的权威键。
- NPC画像、已知线索、轮次、亲密度和最近动作由服务端加载后注入提示词。
- AI 输出采用结构化契约；确定性代码负责验证和落库。
- 长上下文采用“结构化状态 + 滚动摘要 + 最近消息”组合。
- 页面只展示服务端状态，不自行决定关键分数和解锁结果。

## 项目一状态流

```text
创建对局 → 5轮playing
  ├─ NPC对话 → 持久化消息 → AI结构化评估 → 校验 → 更新五维/关系/线索
  ├─ 关系动作 → 服务端扣操作点 → 更新关系 → 记录事件
  └─ 结束本轮 → 第5轮后确定性判定won/lost → 保存final_report → AI复盘
```
