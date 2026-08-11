'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus } from 'lucide-react';

interface DialoguePrompt {
  id: number;
  stage: string;
  name: string;
  prompt: string;
}

const STAGES = [
  { key: 'opening', label: '开场阶段' },
  { key: 'exploration', label: '需求探索阶段' },
  { key: 'presentation', label: '方案呈现阶段' },
  { key: 'objection', label: '异议处理阶段' },
  { key: 'negotiation', label: '谈判阶段' },
  { key: 'closing', label: '成交阶段' },
  { key: 'followup', label: '跟进阶段' },
];

const DEFAULT_PROMPTS: DialoguePrompt[] = [
  { id: 1, stage: 'opening', name: '初次接触', prompt: '你是甲方的关键决策人，玩家正在尝试与你建立联系。请根据你的人设和性格，对玩家的接触做出反应...' },
  { id: 2, stage: 'opening', name: '建立信任', prompt: '玩家正在尝试与你建立信任关系。请根据你对玩家的亲密度和信任度，决定你的态度...' },
  { id: 3, stage: 'exploration', name: '需求挖掘', prompt: '玩家正在尝试了解你的真实需求。请根据你的人设，适当透露或隐藏你的需求...' },
  { id: 4, stage: 'exploration', name: '痛点识别', prompt: '玩家正在尝试识别你的痛点。请根据你的人设，对玩家的 probing 做出反应...' },
  { id: 5, stage: 'presentation', name: '方案介绍', prompt: '玩家正在向你介绍方案。请根据方案与你的需求匹配度，给出反馈...' },
  { id: 6, stage: 'presentation', name: '技术细节', prompt: '玩家正在介绍技术细节。请根据你的专业背景，提出技术问题...' },
  { id: 7, stage: 'objection', name: '价格异议', prompt: '玩家正在尝试处理你的价格异议。请根据你的预算和竞品情况，做出反应...' },
  { id: 8, stage: 'objection', name: '竞品对比', prompt: '玩家正在与竞品进行对比。请根据你对竞品的了解，提出质疑...' },
  { id: 9, stage: 'negotiation', name: '条件谈判', prompt: '玩家正在与你进行条件谈判。请根据你的底线和期望，做出让步或坚持...' },
  { id: 10, stage: 'negotiation', name: '最终报价', prompt: '玩家正在给出最终报价。请根据你的评估，决定是否接受...' },
  { id: 11, stage: 'closing', name: '促成签约', prompt: '玩家正在尝试促成签约。请根据你的决策流程和顾虑，做出最终决定...' },
  { id: 12, stage: 'followup', name: '售后跟进', prompt: '项目已经签约，玩家正在进行售后跟进。请根据项目进展，给出反馈...' },
];

export default function DialoguePromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<DialoguePrompt[]>(DEFAULT_PROMPTS);
  const [activeStage, setActiveStage] = useState('opening');

  const filteredPrompts = prompts.filter(p => p.stage === activeStage);

  const addPrompt = () => {
    const newPrompt: DialoguePrompt = {
      id: Date.now(),
      stage: activeStage,
      name: '新提示词',
      prompt: '',
    };
    setPrompts([...prompts, newPrompt]);
  };

  const updatePrompt = (id: number, field: keyof DialoguePrompt, value: string) => {
    setPrompts(prompts.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const deletePrompt = (id: number) => {
    setPrompts(prompts.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen" style={{ background: '#F6F8FB' }}>
      <header className="h-16 bg-card border-b border-border px-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/designer')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-base font-semibold text-foreground">AI对话提示词</span>
          <span className="text-xs text-muted-foreground">按对话阶段分类的提示词</span>
        </div>
        <button className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5 hover:bg-primary/90">
          <Save className="w-4 h-4" /> 保存
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-6">
        <div className="flex gap-6">
          {/* 左侧阶段列表 */}
          <div className="w-48 shrink-0">
            <div className="bg-card rounded-xl border border-border p-3 sticky top-6">
              <div className="text-xs text-muted-foreground mb-3 px-2">对话阶段</div>
              <div className="space-y-1">
                {STAGES.map(stage => (
                  <button
                    key={stage.key}
                    onClick={() => setActiveStage(stage.key)}
                    className={`w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      activeStage === stage.key
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-surface-container hover:text-foreground'
                    }`}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧提示词列表 */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-foreground">
                {STAGES.find(s => s.key === activeStage)?.label} - 共 {filteredPrompts.length} 个提示词
              </div>
              <button
                onClick={addPrompt}
                className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center gap-1.5 hover:bg-primary/20"
              >
                <Plus className="w-3.5 h-3.5" /> 新增
              </button>
            </div>

            <div className="space-y-4">
              {filteredPrompts.map(prompt => (
                <div key={prompt.id} className="bg-card rounded-xl border border-border p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="text"
                      value={prompt.name}
                      onChange={(e) => updatePrompt(prompt.id, 'name', e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-surface-container border-none text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                      onClick={() => deletePrompt(prompt.id)}
                      className="px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      删除
                    </button>
                  </div>
                  <textarea
                    value={prompt.prompt}
                    onChange={(e) => updatePrompt(prompt.id, 'prompt', e.target.value)}
                    rows={4}
                    placeholder="请输入该阶段的对话提示词..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
