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

当前仍由浏览器保存并回传全部 `history`，`gameSessionId`也只是浏览器生成的临时标识。尚无服务端 conversation、摘要、截断、按 NPC 隔离或持久化；这些属于工作包 C/D。

场景生成前后端已统一为 `industry + productCategory + customRequirement` 请求和 `{ success, scenario }` 响应，且AI JSON必须通过共享契约。

## 目标架构原则

- 服务端 `gameSessionId + npcId` 是会话和游戏状态的权威键。
- NPC画像、已知线索、轮次、亲密度和最近动作由服务端加载后注入提示词。
- AI 输出采用结构化契约；确定性代码负责验证和落库。
- 长上下文采用“结构化状态 + 滚动摘要 + 最近消息”组合。
- 页面只展示服务端状态，不自行决定关键分数和解锁结果。
