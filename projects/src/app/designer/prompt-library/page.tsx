'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FlaskConical, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import {
  DEFAULT_PROJECT_ONE_PROMPT_CONFIG,
  type ProjectOnePromptConfig,
} from '@/lib/designer/prompt-config';
import {
  PROJECT_ONE_CHANNEL_MODIFIERS,
  PROJECT_ONE_FIVE_PERSON_NPCS,
  PROJECT_ONE_NPC_CHANNEL_EXCEPTIONS,
  PROJECT_ONE_PROMPT_LAYERS,
} from '@/lib/designer/project-one-five-person';
import {
  getPromptTestNpcPromptDraftStorageKey,
  getPromptTestUserId,
} from '@/lib/designer/prompt-test-storage';

type PromptItem = { key: string; label: string; description: string };
type PromptGroup = { id: string; label: string; items: PromptItem[] };

const TEST_ROLE_FIELDS = [
  ['rolePositioning', '张建国 · 角色定位'],
  ['responsibilityBoundary', '张建国 · 职责边界'],
  ['replyStyle', '张建国 · 回复长度与风格'],
  ['allowedActions', '张建国 · 允许动作'],
  ['additionalInstructions', '张建国 · 补充指令'],
] as const;

const GROUPS: PromptGroup[] = [
  {
    id: 'live',
    label: '正式游戏',
    items: [{ key: 'live', label: '通用客户对话提示词', description: '正式游戏中所有客户 NPC 的通用角色、回复原则和输出约束。' }],
  },
  {
    id: 'layers',
    label: '对话分层',
    items: Object.values(PROJECT_ONE_PROMPT_LAYERS)
      .sort((a, b) => a.order - b.order)
      .map((layer) => ({ key: `layer:${layer.id}`, label: layer.label, description: layer.description })),
  },
  {
    id: 'roles',
    label: '人物角色',
    items: Object.values(PROJECT_ONE_FIVE_PERSON_NPCS).map((npc) => ({
      key: `npc:${npc.id}`,
      label: `${npc.name} · ${npc.title}`,
      description: '该人物在五人版预览中的完整角色提示，可调整表达与职责边界；人物结构化状态仍由代码管理。',
    })),
  },
  {
    id: 'channels',
    label: '渠道规则',
    items: Object.values(PROJECT_ONE_CHANNEL_MODIFIERS).map((channel) => ({
      key: `channel:${channel.id}`,
      label: channel.label,
      description: channel.description,
    })),
  },
  {
    id: 'exceptions',
    label: '人物×渠道',
    items: Object.entries(PROJECT_ONE_NPC_CHANNEL_EXCEPTIONS).flatMap(([npcId, channels]) =>
      Object.keys(channels).map((channel) => ({
        key: `exception:${npcId}:${channel}`,
        label: `${PROJECT_ONE_FIVE_PERSON_NPCS[npcId as keyof typeof PROJECT_ONE_FIVE_PERSON_NPCS]?.name ?? npcId} · ${PROJECT_ONE_CHANNEL_MODIFIERS[channel as keyof typeof PROJECT_ONE_CHANNEL_MODIFIERS]?.label ?? channel}`,
        description: '覆盖该人物在指定渠道中的表达侧重，不扩大其权限和信息边界。',
      }))),
  },
  {
    id: 'evaluation',
    label: '评估提示',
    items: [
      { key: 'live-eval', label: '正式游戏互动评估补充提示', description: '追加到正式游戏独立评分器，用于调整即时体验、长期支持和证据判断口径。' },
      { key: 'preview-eval', label: '五人版互动评估补充提示', description: '追加到五人版独立评估器，用于调整支持度、愉悦度和有效接触的判断口径。' },
      { key: 'test-eval', label: '双模型测试评估补充提示', description: '追加到 DeepSeek/豆包测试台的独立评估器，不参与 NPC 正文生成。' },
    ],
  },
  {
    id: 'test-role',
    label: '张建国测试角色',
    items: TEST_ROLE_FIELDS.map(([field, label]) => ({
      key: `test-role:${field}`,
      label,
      description: '双模型测试台使用的设计师角色表达配置；业务方原始参考话术在代码中逐字保留。',
    })),
  },
];

function getValue(config: ProjectOnePromptConfig, key: string): string {
  const [kind, first, second] = key.split(':');
  if (kind === 'live') return config.liveCustomerPrompt;
  if (kind === 'layer') return config.promptLayers[first] ?? '';
  if (kind === 'npc') return config.npcRolePrompts[first] ?? '';
  if (kind === 'channel') return config.channelModifiers[first] ?? '';
  if (kind === 'exception') return config.npcChannelExceptions[first]?.[second] ?? '';
  if (kind === 'live-eval') return config.liveEvaluatorPrompt;
  if (kind === 'preview-eval') return config.previewEvaluatorPrompt;
  if (kind === 'test-eval') return config.promptTestEvaluatorPrompt;
  if (kind === 'test-role') return config.promptTestNpcPrompt[first as keyof typeof config.promptTestNpcPrompt] ?? '';
  return '';
}

function withValue(config: ProjectOnePromptConfig, key: string, value: string): ProjectOnePromptConfig {
  const next = structuredClone(config);
  const [kind, first, second] = key.split(':');
  if (kind === 'live') next.liveCustomerPrompt = value;
  else if (kind === 'layer') next.promptLayers[first] = value;
  else if (kind === 'npc') next.npcRolePrompts[first] = value;
  else if (kind === 'channel') next.channelModifiers[first] = value;
  else if (kind === 'exception') {
    next.npcChannelExceptions[first] ??= {};
    next.npcChannelExceptions[first][second] = value;
  } else if (kind === 'preview-eval') next.previewEvaluatorPrompt = value;
  else if (kind === 'live-eval') next.liveEvaluatorPrompt = value;
  else if (kind === 'test-eval') next.promptTestEvaluatorPrompt = value;
  else if (kind === 'test-role') next.promptTestNpcPrompt[first as keyof typeof next.promptTestNpcPrompt] = value;
  return next;
}

export default function PromptLibraryPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ProjectOnePromptConfig>(() => structuredClone(DEFAULT_PROJECT_ONE_PROMPT_CONFIG));
  const [revision, setRevision] = useState(0);
  const [selectedKey, setSelectedKey] = useState(GROUPS[0].items[0].key);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const selected = useMemo(() => GROUPS.flatMap((group) => group.items).find((item) => item.key === selectedKey)!, [selectedKey]);
  const value = getValue(config, selectedKey);

  useEffect(() => {
    const token = window.localStorage.getItem('weixun_session') || '';
    fetch('/api/designer/prompt-config', { headers: { 'x-session': token } })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '读取失败');
        setConfig(body.config);
        setRevision(body.revision);
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : '提示词读取失败'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setNotice('');
    try {
      const token = window.localStorage.getItem('weixun_session') || '';
      const response = await fetch('/api/designer/prompt-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-session': token },
        body: JSON.stringify({ expectedRevision: revision, config }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '保存失败');
      setConfig(body.config);
      setRevision(body.revision);
      const userId = getPromptTestUserId(window.localStorage.getItem('weixun_identity'));
      const draftKey = getPromptTestNpcPromptDraftStorageKey(userId);
      if (draftKey) window.localStorage.setItem(draftKey, JSON.stringify(body.config.promptTestNpcPrompt));
      setDirty(false);
      setNotice('已保存，后续新发起的正式游戏、五人版预览和模型测试将读取最新配置。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '提示词保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB]">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-6 py-4">
          <button onClick={() => router.push('/designer')} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="返回游戏设计师"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">人物对话提示词</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">集中编辑并保存正式游戏、五人预览和双模型测试使用的角色与评估提示。</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => router.push('/designer/dialogue-prompts')} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"><FlaskConical className="h-4 w-4" />模型回复测试</button>
            <button onClick={() => void save()} disabled={loading || saving || !dirty} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40"><Save className="h-4 w-4" />{saving ? '保存中…' : '保存全部'}</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-6 py-6">
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-950">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <div>这里保存的是角色和评估的内容提示。权限验证、敏感信息保护、违规识别、状态结算和 JSON 输出协议仍由代码强制执行，编辑内容不能覆盖这些底线。老板提供的参考话术保持原文，不在这里自动润色。</div>
        </div>
        {notice && <div className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-xs text-foreground">{notice}</div>}
        <div className="grid overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[300px_1fr]">
          <aside className="max-h-[calc(100vh-220px)] overflow-auto border-b border-border p-3 lg:border-b-0 lg:border-r">
            {GROUPS.map((group) => (
              <section key={group.id} className="mb-5 last:mb-0">
                <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button key={item.key} onClick={() => setSelectedKey(item.key)} className={`w-full rounded-lg px-3 py-2 text-left text-xs transition-colors ${selectedKey === item.key ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{item.label}</button>
                  ))}
                </div>
              </section>
            ))}
          </aside>
          <section className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">{selected.label}</h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{selected.description}</p>
              </div>
              <button onClick={() => { setConfig(withValue(config, selectedKey, getValue(DEFAULT_PROJECT_ONE_PROMPT_CONFIG, selectedKey))); setDirty(true); setNotice(''); }} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted"><RotateCcw className="h-3.5 w-3.5" />恢复此项默认值</button>
            </div>
            <textarea
              value={value}
              disabled={loading}
              onChange={(event) => { setConfig(withValue(config, selectedKey, event.target.value)); setDirty(true); setNotice(''); }}
              className="mt-5 h-[560px] w-full resize-y rounded-xl border border-border bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100 outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              placeholder={loading ? '正在读取已保存配置…' : '请输入提示词'}
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span>{value.length} 字 · 配置版本 {revision}</span>
              <span>{dirty ? '有尚未保存的修改' : '当前内容已保存'}</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
