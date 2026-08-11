'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';

export default function EvalPromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState({
    overallEvaluation: '',
    abilityScoring: '',
    strategyEvaluation: '',
    communicationEvaluation: '',
    riskAssessment: '',
    improvementSuggestions: '',
    finalReport: '',
  });

  const updatePrompt = (field: string, value: string) => {
    setPrompts(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen" style={{ background: '#F6F8FB' }}>
      <header className="h-16 bg-card border-b border-border px-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/designer')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-base font-semibold text-foreground">AI评估提示词</span>
          <span className="text-xs text-muted-foreground">AI对玩家进行评估时使用的提示词</span>
        </div>
        <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5 hover:bg-primary/90">
          <Save className="w-4 h-4" /> 保存
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-6">
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-5">
            <label className="text-sm font-semibold text-foreground mb-2 block">整体评估提示词</label>
            <p className="text-xs text-muted-foreground mb-3">用于AI对玩家整体表现进行评估的提示词</p>
            <textarea
              value={prompts.overallEvaluation}
              onChange={(e) => updatePrompt('overallEvaluation', e.target.value)}
              rows={4}
              placeholder="请输入整体评估的提示词，例如：请根据玩家在整个游戏过程中的表现，从战略眼光、执行能力、沟通技巧等维度进行综合评估..."
              className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <label className="text-sm font-semibold text-foreground mb-2 block">能力评分提示词</label>
            <p className="text-xs text-muted-foreground mb-3">用于AI对玩家各项能力进行评分的提示词</p>
            <textarea
              value={prompts.abilityScoring}
              onChange={(e) => updatePrompt('abilityScoring', e.target.value)}
              rows={4}
              placeholder="请输入能力评分的提示词，例如：请对玩家的需求洞察能力、关系建立能力、方案呈现能力、谈判技巧、应变能力等进行1-10分的评分..."
              className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <label className="text-sm font-semibold text-foreground mb-2 block">策略评估提示词</label>
            <p className="text-xs text-muted-foreground mb-3">用于AI对玩家策略进行评估的提示词</p>
            <textarea
              value={prompts.strategyEvaluation}
              onChange={(e) => updatePrompt('strategyEvaluation', e.target.value)}
              rows={4}
              placeholder="请输入策略评估的提示词，例如：请评估玩家制定的攻坚策略是否合理，时机把握是否准确，资源利用是否高效..."
              className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <label className="text-sm font-semibold text-foreground mb-2 block">沟通评估提示词</label>
            <p className="text-xs text-muted-foreground mb-3">用于AI对玩家沟通能力进行评估的提示词</p>
            <textarea
              value={prompts.communicationEvaluation}
              onChange={(e) => updatePrompt('communicationEvaluation', e.target.value)}
              rows={4}
              placeholder="请输入沟通评估的提示词，例如：请评估玩家在与甲方沟通时的有效性、专业度、需求理解程度..."
              className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <label className="text-sm font-semibold text-foreground mb-2 block">风险评估提示词</label>
            <p className="text-xs text-muted-foreground mb-3">用于AI对玩家风险识别和控制能力进行评估的提示词</p>
            <textarea
              value={prompts.riskAssessment}
              onChange={(e) => updatePrompt('riskAssessment', e.target.value)}
              rows={4}
              placeholder="请输入风险评估的提示词，例如：请评估玩家在游戏过程中对竞品威胁、内部阻力、预算风险等的识别和控制能力..."
              className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <label className="text-sm font-semibold text-foreground mb-2 block">改进建议提示词</label>
            <p className="text-xs text-muted-foreground mb-3">用于AI生成玩家改进建议的提示词</p>
            <textarea
              value={prompts.improvementSuggestions}
              onChange={(e) => updatePrompt('improvementSuggestions', e.target.value)}
              rows={4}
              placeholder="请输入改进建议的提示词，例如：请根据玩家的表现，给出针对性的改进建议，帮助玩家提升销售技能..."
              className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="bg-card rounded-xl border border-border p-5">
            <label className="text-sm font-semibold text-foreground mb-2 block">最终报告提示词</label>
            <p className="text-xs text-muted-foreground mb-3">用于AI生成最终评估报告的提示词</p>
            <textarea
              value={prompts.finalReport}
              onChange={(e) => updatePrompt('finalReport', e.target.value)}
              rows={4}
              placeholder="请输入最终报告的提示词，例如：请生成一份完整的玩家评估报告，包括总体评分、各维度得分、亮点与不足、改进建议等..."
              className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
