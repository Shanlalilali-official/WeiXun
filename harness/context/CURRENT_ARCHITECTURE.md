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

当前 NPC 对话使用 `messages` React State 保存历史；每次发送时把全部历史传给后端，后端重新加入系统提示词。没有服务端 conversation、摘要、截断、按 NPC 隔离或持久化。

## 目标架构原则

- 服务端 `gameSessionId + npcId` 是会话和游戏状态的权威键。
- NPC画像、已知线索、轮次、亲密度和最近动作由服务端加载后注入提示词。
- AI 输出采用结构化契约；确定性代码负责验证和落库。
- 长上下文采用“结构化状态 + 滚动摘要 + 最近消息”组合。
- 页面只展示服务端状态，不自行决定关键分数和解锁结果。

