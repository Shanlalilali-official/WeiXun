// AI 场景生成 API（setup 页面用）
import { NextRequest, NextResponse } from 'next/server';
import { authGuard } from '@/lib/auth/guard';
import { invokeLLM } from '@/lib/ai/client';
import { SCENARIO_GENERATOR_PROMPT } from '@/lib/ai/prompts/scenario-generator';

export const runtime = 'nodejs';

interface GenerateRequest {
  industry: string;
  productCategory: string;
  customRequirement?: string;
}

export async function POST(request: NextRequest) {
  const guard = authGuard(request);
  if (!guard.ok) return guard.response!;

  try {
    const body: GenerateRequest = await request.json();
    const { industry, productCategory, customRequirement } = body;

    if (!industry || !productCategory) {
      return NextResponse.json({ error: '行业和产品分类必填' }, { status: 400 });
    }

    const prompt = SCENARIO_GENERATOR_PROMPT
      .replace(/\{\{industry\}\}/g, industry)
      .replace(/\{\{productCategory\}\}/g, productCategory)
      .replace(/\{\{customRequirement\}\}/g, customRequirement || '无');

    const result = await invokeLLM(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: `行业：${industry}\n产品分类：${productCategory}\n${customRequirement ? `补充：${customRequirement}` : ''}` },
      ],
      { temperature: 0.8, model: 'doubao-seed-2-0-pro-260215' }
    );

    // 尝试解析 JSON（LLM 可能包了 markdown 代码块）
    let json: unknown;
    try {
      const cleaned = result.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      json = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ error: '场景生成失败', raw: result }, { status: 500 });
    }

    return NextResponse.json({ success: true, scenario: json });
  } catch (err) {
    return NextResponse.json({ error: '生成失败', detail: String(err) }, { status: 500 });
  }
}
