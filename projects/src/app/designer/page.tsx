'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Building2, Users, FileText, Save, ArrowLeft, UserCog, BarChart3, Copy, Plus, Trash2, Pencil, X, LogOut, ShieldCheck, FlaskConical, Library, Database, ImageIcon, FileBarChart, TestTube2, PlayCircle, ClipboardList, Upload, Sparkles, FolderOpen } from 'lucide-react';
import { aMetrics, bMetrics, cMetrics } from '@/lib/metrics-data';
import {
  PROJECT_ONE_CHANNEL_MODIFIERS,
  PROJECT_ONE_FIVE_PERSON_NPCS,
  PROJECT_ONE_HARD_CONSTRAINTS,
  PROJECT_ONE_NPC_CHANNEL_EXCEPTIONS,
  PROJECT_ONE_PROMPT_LAYERS,
  PROJECT_ONE_PROMPT_NODES,
} from '@/lib/designer/project-one-five-person';
import { ROLE_COLOR, ROLE_LABEL } from '@/components/app-shell';

type ConfigRecord = Record<string, unknown>;

interface FivePersonNpcConfig extends ConfigRecord {
  id: string;
  name: string;
  title?: string;
  parentId?: string | null;
  displayOrder?: number;
  displayLevel?: number;
}

interface PromptNodeConfig extends ConfigRecord {
  id: string;
  name?: string;
  label?: string;
  supportThreshold?: number;
  contactThreshold?: number;
  effectiveContactThreshold?: number;
  evidenceTags?: readonly string[];
  blockerPolicy?: string;
  goal?: string;
}

interface PromptLayerConfig extends ConfigRecord {
  id: string;
  label?: string;
  name?: string;
  description?: string;
  template?: string;
  content?: string;
}

function configRecords(value: unknown): ConfigRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is ConfigRecord => Boolean(item && typeof item === 'object'));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as ConfigRecord).map(([id, item]) => ({
    id,
    ...(item && typeof item === 'object' ? item : { value: item }),
  }));
}

function configEntries(value: unknown): Array<[string, ConfigRecord]> {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is ConfigRecord => Boolean(item && typeof item === 'object'))
      .map((item, index) => [String(item.id ?? item.key ?? item.channel ?? index), item]);
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as ConfigRecord).map(([key, item]) => [
    key,
    item && typeof item === 'object' ? item as ConfigRecord : { value: item },
  ]);
}

function configText(record: ConfigRecord | undefined, ...keys: string[]): string {
  if (!record) return '';
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').join('；');
  }
  return '';
}

function configNumber(record: ConfigRecord | undefined, ...keys: string[]): number | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function configList(record: ConfigRecord | undefined, ...keys: string[]): string[] {
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    if (typeof value === 'string' && value.trim()) return value.split(/[；;,]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

const fivePersonNpcs = configRecords(PROJECT_ONE_FIVE_PERSON_NPCS) as FivePersonNpcConfig[];
const promptNodes = configRecords(PROJECT_ONE_PROMPT_NODES) as PromptNodeConfig[];
const promptLayers = (configRecords(PROJECT_ONE_PROMPT_LAYERS) as PromptLayerConfig[])
  .sort((left, right) => (configNumber(left, 'order') ?? 999) - (configNumber(right, 'order') ?? 999));
const channelModifierEntries = configEntries(PROJECT_ONE_CHANNEL_MODIFIERS);
const npcChannelExceptionEntries = configEntries(PROJECT_ONE_NPC_CHANNEL_EXCEPTIONS);
const PROMPT_LAYER_ORDER = [
  'hard_constraints',
  'npc_baseline',
  'state_node',
  'runtime_state',
  'working_memory',
  'recent_history',
  'channel_modifier',
  'npc_channel_exception',
];
const orderedPromptLayers = [
  ...PROMPT_LAYER_ORDER.map((id) => promptLayers.find((layer) => layer.id === id)).filter((layer): layer is PromptLayerConfig => Boolean(layer)),
  ...promptLayers.filter((layer) => !PROMPT_LAYER_ORDER.includes(layer.id) && layer.id !== 'task'),
];

interface KeyPerson {
  id: number | string;
  name: string;
  title: string;
  gender: string;
  age: number;
  hometown: string;
  personality: string;
  weakness: string;
}

const projectOneKeyPersons: KeyPerson[] = fivePersonNpcs.map((person) => ({
  id: person.id,
  name: person.name,
  title: person.title ?? '',
  gender: '',
  age: 0,
  hometown: '',
  personality: configText(person, 'personality'),
  weakness: '',
}));

const FALLBACK_PROJECTS: ProjectConfig[] = [
  {
    id: 1,
    name: '项目一·单单位内部竞标',
    budget: 100,
    description: '',
    products: '',
    keyPersons: projectOneKeyPersons,
    aiPrompt: '',
    successCriteria: '',
    scoringStandard: '',
  },
];

interface ProjectConfig {
  id: number;
  name: string;
  budget: number;
  description: string;
  products: string;
  keyPersons: KeyPerson[];
  aiPrompt: string;
  successCriteria: string;
  scoringStandard: string;
}

interface Competitor {
  id: number;
  project_id: number;
  company_name: string;
  features: string;
  more_info: string;
}

interface ProjectApiItem {
  project_id: number;
  name?: string;
  budget?: number;
  description?: string;
  products?: string;
  ai_prompt?: string;
  success_criteria?: string;
  scoring_standard?: string;
}

interface NpcApiItem {
  project_id: number;
  id: number;
  name?: string;
  title?: string;
  gender?: string;
  age?: number;
  hometown?: string;
  personality?: string;
  weakness?: string;
}

export default function DesignerPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectConfig[]>(FALLBACK_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<number>(1);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<'assets' | 'data' | 'scenario' | 'reports' | 'testing'>('assets');
  const [selectedDataTab, setSelectedDataTab] = useState<'project' | 'competitors' | 'metrics'>('project');
  const [selectedScenarioTab, setSelectedScenarioTab] = useState<'images' | 'prompts'>('images');
  const [selectedMetricTab, setSelectedMetricTab] = useState('A类基础指标');
  const [a, setA] = useState(aMetrics);
  const [b, setB] = useState(bMetrics);
  const [c, setC] = useState(cMetrics);
  const metricTabs = ['A类基础指标', 'B类中级指标', 'C类高级指标', '情商', '销售风格', '关系建立', '影响力', '提升空间', '价值观', '能量与活力', '大订单运作能力'];
  // 指标编辑状态
  const [editingMetric, setEditingMetric] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', desc: '', value: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ tag: '', name: '', desc: '', value: '', category: '' });
  // 公式大弹窗编辑状态
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [formulaModalData, setFormulaModalData] = useState({ tag: '', name: '', formula: '' });
  const [selectedPromptNpcId, setSelectedPromptNpcId] = useState(fivePersonNpcs[0]?.id || 'P1-001');
  const [selectedPromptNodeId, setSelectedPromptNodeId] = useState(promptNodes[0]?.id || 'N1');
  const [selectedPromptLayerId, setSelectedPromptLayerId] = useState(orderedPromptLayers[0]?.id || 'hard_constraints');
  const [promptView, setPromptView] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    const importedMetrics = window.localStorage.getItem('weixun_designer_excel_import:metrics');
    if (importedMetrics) {
      try {
        const parsed = JSON.parse(importedMetrics) as { rows?: Array<Record<string, unknown>> };
        const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
        if (rows.length > 0) {
          setA(rows.filter((row) => row.kind === 'A').map((row) => ({ tag: String(row.tag), name: String(row.name), desc: String(row.desc || ''), init: String(row.value ?? '0'), ...(row.category ? { category: String(row.category) } : {}) })));
          setB(rows.filter((row) => row.kind === 'B').map((row) => ({ tag: String(row.tag), name: String(row.name), desc: String(row.desc || ''), formula: String(row.value ?? '0'), ...(row.category ? { category: String(row.category) } : {}) })));
          setC(rows.filter((row) => row.kind === 'C').map((row) => ({ tag: String(row.tag), name: String(row.name), desc: String(row.desc || ''), formula: String(row.value ?? '0'), ...(row.category ? { category: String(row.category) } : {}) })));
          setSelectedModule('data');
          setSelectedDataTab('metrics');
        }
      } catch {
        // 无效草稿保持默认指标，不阻断设计师工作台。
      }
    }

    // 加载项目数据
    fetch('/api/game-data/projects')
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setProjects(d.data.map((p: ProjectApiItem) => ({
            id: p.project_id,
            name: p.name,
            budget: p.budget || 100,
            description: p.description || '',
            products: p.products || '',
            keyPersons: p.project_id === 1 ? projectOneKeyPersons : [],
            aiPrompt: p.ai_prompt || '',
            successCriteria: p.success_criteria || '',
            scoringStandard: p.scoring_standard || '',
          })));
        }
      })
      .catch(() => {});

    // 加载竞品数据
    fetch('/api/game-data/competitors')
      .then(r => r.json())
      .then(d => setCompetitors(d.data || []))
      .catch(() => {});

    // 加载 NPC 数据
    fetch('/api/game-data/npcs')
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          const personsByProject: Record<number, KeyPerson[]> = {};
          d.data.forEach((npc: NpcApiItem) => {
            if (!personsByProject[npc.project_id]) personsByProject[npc.project_id] = [];
            personsByProject[npc.project_id].push({
              id: npc.id,
              name: npc.name || '',
              title: npc.title || '',
              gender: npc.gender || '',
              age: npc.age || 0,
              hometown: npc.hometown || '',
              personality: npc.personality || '',
              weakness: npc.weakness || '',
            });
          });
          setProjects(prev => prev.map(p => ({
            ...p,
            keyPersons: p.id === 1 ? projectOneKeyPersons : personsByProject[p.id] || [],
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currentProject = projects.find(p => p.id === selectedProject);
  const currentCompetitors = competitors.filter(c => c.project_id === selectedProject);
  const selectedPromptNpc = fivePersonNpcs.find((npc) => npc.id === selectedPromptNpcId) ?? fivePersonNpcs[0];
  const selectedPromptNode = promptNodes.find((node) => node.id === selectedPromptNodeId) ?? promptNodes[0];
  const selectedPromptLayer = orderedPromptLayers.find((layer) => layer.id === selectedPromptLayerId) ?? orderedPromptLayers[0];
  const selectedPromptLayerText = selectedPromptLayer
    ? configText(selectedPromptLayer, 'template', 'content', 'prompt', 'text') || (selectedPromptLayer.id === 'hard_constraints' ? PROJECT_ONE_HARD_CONSTRAINTS.join('\n') : '')
    : '';
  const selectedPromptNpcIndex = selectedPromptNpc ? fivePersonNpcs.findIndex((npc) => npc.id === selectedPromptNpc.id) : -1;
  const selectedPromptParent = selectedPromptNpc?.parentId
    ? fivePersonNpcs.find((npc) => npc.id === selectedPromptNpc.parentId)
    : undefined;
  const selectedNpcFacts = configList(selectedPromptNpc, 'facts', 'summary', 'responsibilities', 'focus');
  const selectedNpcNeeds = configList(selectedPromptNpc, 'coreNeeds', 'needs', 'priorities', 'goals');
  const selectedNpcBoundaries = configList(selectedPromptNpc, 'informationBoundary', 'boundaries', 'disclosureRules');
  const selectedNpcTaboos = configList(selectedPromptNpc, 'taboos', 'redLines', 'risks');
  const promptChannels = channelModifierEntries.map(([key, value]) => ({
    key,
    label: configText(value, 'label', 'name', 'title') || key,
    text: configText(value, 'description', 'modifier', 'template', 'prompt', 'content', 'value'),
  }));
  const selectedNpcExceptions = selectedPromptNpc
    ? (() => {
      const entry = npcChannelExceptionEntries.find(([key]) => key === selectedPromptNpc.id);
      return entry ? configEntries(entry[1]) : [];
    })()
    : [];
  const promptPreview = [
    ...orderedPromptLayers.map((layer) => ({
      id: layer.id,
      label: configText(layer, 'label', 'name') || layer.id,
      text: configText(layer, 'template', 'content', 'prompt', 'text', 'description') || (layer.id === 'hard_constraints' ? PROJECT_ONE_HARD_CONSTRAINTS.join('\n') : ''),
    })),
    {
      id: 'runtime-selection',
      label: '当前选择',
      text: `${configText(selectedPromptNpc, 'name') || '未选择人物'} · ${configText(selectedPromptNode, 'label', 'name') || '未选择节点'} · ${promptChannels[0]?.label || '渠道待选择'}`,
    },
  ].filter((section) => section.text.trim());

  if (loading) {
    return (
      <div className="min-h-screen bg-role-designer flex items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-role-designer border-t-transparent rounded-full animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  // 指标编辑处理函数
  const handleEditMetric = (tag: string, name: string, desc: string, value: string) => {
    setEditingMetric(tag);
    setEditForm({ name, desc, value });
  };

  const handleSaveEdit = () => {
    if (!editingMetric) return;
    // A类
    const aIdx = a.findIndex(m => m.tag === editingMetric);
    if (aIdx >= 0) {
      const updated = [...a];
      updated[aIdx] = { ...updated[aIdx], name: editForm.name, desc: editForm.desc, init: editForm.value };
      setA(updated);
      setEditingMetric(null);
      return;
    }
    // B类
    const bIdx = b.findIndex(m => m.tag === editingMetric);
    if (bIdx >= 0) {
      const updated = [...b];
      updated[bIdx] = { ...updated[bIdx], name: editForm.name, desc: editForm.desc, formula: editForm.value };
      setB(updated);
      setEditingMetric(null);
      return;
    }
    // C类
    const cIdx = c.findIndex(m => m.tag === editingMetric);
    if (cIdx >= 0) {
      const updated = [...c];
      updated[cIdx] = { ...updated[cIdx], name: editForm.name, desc: editForm.desc, formula: editForm.value };
      setC(updated);
      setEditingMetric(null);
    }
  };

  const handleDeleteMetric = (tag: string) => {
    setA(a.filter(m => m.tag !== tag));
    setB(b.filter(m => m.tag !== tag));
    setC(c.filter(m => m.tag !== tag));
  };

  // 公式弹窗保存
  const handleSaveFormulaModal = () => {
    const { tag, formula } = formulaModalData;
    const aIdx = a.findIndex(m => m.tag === tag);
    if (aIdx >= 0) {
      const updated = [...a];
      updated[aIdx] = { ...updated[aIdx], init: formula };
      setA(updated);
      return;
    }
    const bIdx = b.findIndex(m => m.tag === tag);
    if (bIdx >= 0) {
      const updated = [...b];
      updated[bIdx] = { ...updated[bIdx], formula };
      setB(updated);
      return;
    }
    const cIdx = c.findIndex(m => m.tag === tag);
    if (cIdx >= 0) {
      const updated = [...c];
      updated[cIdx] = { ...updated[cIdx], formula };
      setC(updated);
    }
  };

  const handleAddMetric = () => {
    if (!addForm.tag || !addForm.name) return;
    const newItem = { tag: addForm.tag, name: addForm.name, desc: addForm.desc, category: addForm.category };
    if (selectedMetricTab === 'A类基础指标') {
      setA([...a, { ...newItem, init: addForm.value || '0' }]);
    } else if (selectedMetricTab === 'B类中级指标') {
      setB([...b, { ...newItem, formula: addForm.value || '0' }]);
    } else if (selectedMetricTab === 'C类高级指标') {
      setC([...c, { ...newItem, formula: addForm.value || '0' }]);
    }
    setAddForm({ tag: '', name: '', desc: '', value: '', category: '' });
    setShowAddForm(false);
  };

  return (
    <div className="min-h-screen bg-role-designer">
      {/* 顶部导航 */}
      <header className="topbar-glass sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => router.push('/')} className="text-muted-foreground hover:text-foreground p-2 hover:bg-muted rounded-lg transition-colors" title="返回首页">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: ROLE_COLOR.platform_designer }}>
                <Wand2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">游戏设计师工作台</div>
                <div className="text-[10px] text-muted-foreground">管理游戏素材 · 数据 · 场景 · 报告 · 测试</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="hidden sm:flex px-2.5 py-1.5 rounded-lg text-xs font-medium items-center gap-1.5 text-white shadow-sm"
              style={{ background: ROLE_COLOR.platform_designer }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{ROLE_LABEL.platform_designer}</span>
            </div>
            <button
              onClick={() => {
                document.cookie = 'weixun_session=; path=/; max-age=0';
                document.cookie = 'weixun_identity=; path=/; max-age=0';
                try { localStorage.removeItem('weixun_identity'); localStorage.removeItem('weixun_session'); } catch {}
                router.push('/');
              }}
              className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-6">
        {/* 项目选择 */}
        <div className="mb-6 flex items-center gap-4 flex-wrap animate-fade-up">
          <span className="text-sm font-semibold text-foreground uppercase tracking-wider">选择项目：</span>
          <div className="flex gap-2 flex-wrap">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedProject === p.id
                    ? 'btn-primary text-primary-foreground shadow-sm'
                    : 'bg-card text-muted-foreground hover:text-foreground border border-border'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* 一级工作区 */}
        <nav aria-label="设计师工作区" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { id: 'assets' as const, label: '素材库', hint: '人物资料与提示词', icon: Library },
            { id: 'data' as const, label: '数据', hint: '项目、竞品与指标', icon: Database },
            { id: 'scenario' as const, label: '场景', hint: '场景图片与提示词', icon: ImageIcon },
            { id: 'reports' as const, label: '报告', hint: '玩家生成的报告', icon: FileBarChart },
            { id: 'testing' as const, label: '测试', hint: '实际测试与模型回复', icon: TestTube2 },
          ].map((section) => {
            const Icon = section.icon;
            const active = selectedModule === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setSelectedModule(section.id)}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                  active
                    ? 'border-role-designer bg-role-designer/10 text-role-designer shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:border-role-designer/40 hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-role-designer text-white' : 'bg-muted text-muted-foreground group-hover:text-role-designer'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{section.label}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{section.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {selectedModule === 'data' && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
            <span className="mr-2 text-xs font-semibold text-foreground">数据分类</span>
            {[
              { id: 'project' as const, label: '项目数据', icon: Building2 },
              { id: 'competitors' as const, label: '竞品数据', icon: Users },
              { id: 'metrics' as const, label: '指标体系', icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = selectedDataTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedDataTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {tab.label}
                </button>
              );
            })}
            <button
              onClick={() => router.push('/designer/data-import-export')}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <Upload className="h-3.5 w-3.5" /> Excel 导入导出
            </button>
          </div>
        )}

        {selectedModule === 'assets' && (
          <div className="space-y-4 animate-fade-up">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-role-designer/10 text-role-designer">
                  <Library className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">素材库</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">集中管理人物资料、人物提示词和后续可复用的视觉素材。</p>
                </div>
              </div>
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success">当前项目 · {currentProject?.name || '项目一'}</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <button
                onClick={() => router.push('/designer/key-persons')}
                className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><UserCog className="h-5 w-5" /></span>
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">人物</span>
                </div>
                <div className="text-sm font-semibold text-foreground">人物资料</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">维护关键人的基础信息、性格和沟通画像。</p>
                <div className="mt-4 text-xs font-medium text-primary">{currentProject?.keyPersons.length || 0} 位人物 · 查看资料 →</div>
              </button>

              <button
                onClick={() => router.push('/designer/prompt-library')}
                className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-violet-400/60 hover:shadow-md"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><FlaskConical className="h-5 w-5" /></span>
                  <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] text-violet-600">提示词</span>
                </div>
                <div className="text-sm font-semibold text-foreground">人物提示词设计</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">按人物和交流渠道维护角色表达；系统规则由代码统一保护。</p>
                <div className="mt-4 text-xs font-medium text-violet-600">打开人物提示词 →</div>
              </button>

              <div className="rounded-xl border border-dashed border-border bg-muted/40 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/10 text-slate-500"><ImageIcon className="h-5 w-5" /></span>
                  <span className="rounded-full bg-slate-500/10 px-2 py-1 text-[10px] text-slate-500">空状态</span>
                </div>
                <div className="text-sm font-semibold text-foreground">人物图片素材</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">暂未上传人物肖像或状态图，后续可在此集中维护。</p>
                <button disabled className="mt-4 flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground/60">
                  <Upload className="h-3.5 w-3.5" /> 上传图片（待开放）
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">素材使用说明</span>
              </div>
              <div className="grid gap-3 text-xs leading-5 text-muted-foreground md:grid-cols-3">
                <div className="rounded-lg bg-muted/60 p-3"><span className="font-medium text-foreground">人物资料</span><br />用于维护人物主档和游戏中的可披露信息。</div>
                <div className="rounded-lg bg-muted/60 p-3"><span className="font-medium text-foreground">人物提示词</span><br />按人物和交流渠道维护角色表达，规则性约束不开放编辑。</div>
                <div className="rounded-lg bg-muted/60 p-3"><span className="font-medium text-foreground">图片素材</span><br />当前保留空状态，不影响文字和模型测试流程。</div>
              </div>
            </div>
          </div>
        )}

        {selectedModule === 'scenario' && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">场景资源</span>
              <span className="text-xs text-muted-foreground">图片素材为主，提示词独立维护</span>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <button
                onClick={() => setSelectedScenarioTab('images')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${selectedScenarioTab === 'images' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                场景图片
              </button>
              <button
                onClick={() => setSelectedScenarioTab('prompts')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${selectedScenarioTab === 'prompts' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                场景提示词
              </button>
            </div>
          </div>
        )}

        {selectedModule === 'scenario' && selectedScenarioTab === 'images' && (
          <div className="space-y-4 animate-fade-up">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                { title: '项目地图', description: '项目一的整体场景与流程背景。', image: '/game-map.webp' },
                { title: '会面环境', description: '拜访流程使用的空场景背景。', image: '/images/game/visit-meeting-room-empty-v1.png' },
                { title: '对话场景', description: '人物对话时使用的场景素材。', image: '/images/game/visit-dialogue-scene-v1.png' },
              ].map((scene) => (
                <article key={scene.title} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="h-40 bg-muted bg-cover bg-center" style={{ backgroundImage: `url('${scene.image}')` }} role="img" aria-label={scene.title} />
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{scene.title}</h3>
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success">已就绪</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{scene.description}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/40 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-500/10 text-slate-500"><ImageIcon className="h-4 w-4" /></div>
                <div>
                  <div className="text-sm font-medium text-foreground">更多场景图片</div>
                  <div className="text-xs text-muted-foreground">上传入口暂未开放，当前先使用项目内置素材。</div>
                </div>
              </div>
              <button disabled className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground/60"><Upload className="h-3.5 w-3.5" /> 上传图片（待开放）</button>
            </div>
          </div>
        )}

        {selectedModule === 'reports' && (
          <div className="rounded-xl border border-border bg-card p-8 text-center animate-fade-up">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-role-designer/10 text-role-designer"><FileBarChart className="h-6 w-6" /></div>
            <h2 className="mt-4 text-base font-semibold text-foreground">玩家生成报告</h2>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">完成对局并生成复盘报告后，报告会集中出现在这里。当前暂无可查看的玩家报告。</p>
            <div className="mx-auto mt-6 grid max-w-xl gap-3 text-left sm:grid-cols-3">
              {['对局复盘', '能力诊断', '行动记录'].map((item) => (
                <div key={item} className="rounded-lg border border-dashed border-border bg-muted/40 p-3">
                  <div className="text-xs font-medium text-muted-foreground">{item}</div>
                  <div className="mt-2 text-[10px] text-muted-foreground/70">暂无记录</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedModule === 'testing' && (
          <div className="space-y-4 animate-fade-up">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-role-designer/10 text-role-designer"><TestTube2 className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">测试中心</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">按测试目标选择实际测试或模型回复测试，测试记录与正式数据分开。</p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <button
                onClick={() => router.push('/project-one-preview')}
                className="group rounded-xl border border-border bg-card p-6 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><PlayCircle className="h-6 w-6" /></span>
                  <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success">可用</span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">实际测试</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">进入项目一五人版前端测试页，体验完整作战台和真实 AI 交互预览。</p>
                <div className="mt-5 text-xs font-medium text-primary">进入实际测试 →</div>
              </button>
              <button
                onClick={() => router.push('/designer/dialogue-prompts')}
                className="group rounded-xl border border-border bg-card p-6 text-left transition-all hover:-translate-y-0.5 hover:border-violet-400/60 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><ClipboardList className="h-6 w-6" /></span>
                  <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-600">双轨</span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">模型回复测试</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">使用同一输入对比 DeepSeek Flash 与豆包的 NPC 回复、评估和状态变化。</p>
                <div className="mt-5 text-xs font-medium text-violet-600">进入模型回复测试 →</div>
              </button>
            </div>
          </div>
        )}

        {/* 根据选中的工作区显示不同内容 */}
        {selectedModule === 'data' && selectedDataTab === 'project' && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">项目数据</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{currentProject?.name || '项目一'} · 项目配置</span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <button
                onClick={() => router.push('/designer/client-info')}
                className="bg-muted rounded-xl border border-border p-4 hover:border-primary/50 hover:shadow-md transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="text-sm font-semibold text-foreground">甲方基本信息</div>
                <div className="text-[10px] text-muted-foreground mt-1">预算、介绍、产品</div>
              </button>

              <div className="bg-muted rounded-xl border border-border p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <FileText className="w-5 h-5 text-success" />
                </div>
                <div className="text-sm font-semibold text-foreground">项目概览</div>
                <div className="mt-2 space-y-1 text-[10px] leading-5 text-muted-foreground">
                  <div>预算：{currentProject?.budget ? `${currentProject.budget} 万元` : '待配置'}</div>
                  <div>产品：{currentProject?.products || '待配置'}</div>
                </div>
              </div>

              <div className="bg-muted rounded-xl border border-border p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-role-designer/10">
                  <Sparkles className="w-5 h-5 text-role-designer" />
                </div>
                <div className="text-sm font-semibold text-foreground">配置状态</div>
                <div className="mt-2 space-y-1 text-[10px] leading-5 text-muted-foreground">
                  <div>关键人物：{currentProject?.keyPersons.length || 0} 人</div>
                  <div>竞品记录：{currentCompetitors.length} 家</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedModule === 'data' && selectedDataTab === 'competitors' && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> 竞品数据
              <span className="ml-auto text-[10px] font-normal text-muted-foreground">当前项目 · {currentCompetitors.length} 家</span>
            </div>
            {currentCompetitors.length > 0 ? (
              <div className="space-y-3">
                {currentCompetitors.map(c => (
                  <div key={c.id} className="bg-muted rounded-lg p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-foreground">{c.company_name}</div>
                      <button className="text-xs text-primary hover:text-primary/80">编辑</button>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
                      <span className="font-medium">产品特点：</span>{c.features}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">更多信息：</span>{c.more_info}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">暂无竞品数据</div>
            )}
            <button className="mt-4 w-full px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20">
              添加竞品
            </button>
          </div>
        )}

        {selectedModule === 'scenario' && selectedScenarioTab === 'prompts' && (
          <div className="space-y-4 animate-fade-up">
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">项目一 · 五人版分层提示词</h2>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">共享配置源</span>
                    </div>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                      硬约束、状态节点、运行时状态、记忆和渠道通用规则由系统统一管理；设计师只维护人物及人物渠道提示词。
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
                  <div className="font-semibold">Evaluator 独立运行</div>
                  <div>最终状态由代码 Resolver 结算，不由 NPC 提示词直接写入。</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <div className="mr-1 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" /> 选择人物
                </div>
                {fivePersonNpcs.map((person) => {
                  const active = selectedPromptNpc?.id === person.id;
                  return (
                    <button
                      key={person.id}
                      onClick={() => setSelectedPromptNpcId(person.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-primary-foreground/20' : 'bg-card'}`}>
                        {person.name.slice(0, 1)}
                      </span>
                      <span>
                        <span className="block text-xs font-semibold">{person.name}</span>
                        <span className={`block text-[10px] ${active ? 'text-primary-foreground/70' : 'text-muted-foreground/70'}`}>{person.title || '职位待配置'}</span>
                      </span>
                    </button>
                  );
                })}
                <span className="ml-auto text-[10px] text-muted-foreground">{fivePersonNpcs.length} 位受控人物 · 稳定 ID</span>
              </div>
            </section>

            {fivePersonNpcs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                五人版共享人物配置尚未提供，提示词编辑器暂不可用。
              </div>
            ) : (
              <>
                <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Users className="h-4 w-4 text-primary" /> 组织与人物摘要
                      </div>
                      <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{selectedPromptNpcIndex >= 0 ? `第 ${selectedPromptNpcIndex + 1} 位` : '未选择'}</span>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {fivePersonNpcs.map((person) => {
                        const active = selectedPromptNpc?.id === person.id;
                        const level = configNumber(person, 'displayLevel', 'level') ?? 0;
                        return (
                          <button
                            key={person.id}
                            onClick={() => setSelectedPromptNpcId(person.id)}
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                            style={{ paddingLeft: `${12 + Math.min(level, 3) * 14}px` }}
                          >
                            <span className={`h-2 w-2 rounded-full ${active ? 'bg-primary' : 'bg-border'}`} />
                            <span className="font-medium">{person.name}</span>
                            <span className="ml-auto text-[10px] text-muted-foreground">{person.title || '职位待配置'}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
                      <div className="mb-1 font-semibold text-foreground">组织路径</div>
                      <div>{selectedPromptParent?.name ? `${selectedPromptParent.name} → ` : '组织根节点 → '}{selectedPromptNpc?.name || '未选择'}</div>
                      <div className="mt-1 text-[10px]">parentId / displayLevel / displayOrder 来自五人版共享主档。</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-foreground">{selectedPromptNpc?.name || '未选择人物'}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{selectedPromptNpc?.title || '职位待配置'} · 人物主档摘要</div>
                      </div>
                      <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success">受控人物</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        ['职责 / 关注', selectedNpcFacts],
                        ['核心诉求', selectedNpcNeeds],
                        ['可披露边界', selectedNpcBoundaries],
                        ['绝对禁忌 / 风险', selectedNpcTaboos],
                      ].map(([label, values]) => (
                        <div key={label as string} className="rounded-lg bg-muted/60 p-3">
                          <div className="text-[10px] font-semibold text-foreground">{label as string}</div>
                          <div className="mt-1 text-xs leading-5 text-muted-foreground">
                            {(values as string[]).length > 0 ? (values as string[]).join('；') : '共享主档暂未填写'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <ShieldCheck className="h-4 w-4 text-primary" /> 状态节点 · 阻断优先
                      </div>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">节点升级必须同时满足支持度、有效接触和证据条件；存在活动阻断时始终停留在 BLOCKED。</p>
                    </div>
                    <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-medium text-rose-600">N1 → N4 / BLOCKED</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {promptNodes.map((node) => {
                      const active = selectedPromptNode?.id === node.id;
                      const isBlocked = node.id === 'BLOCKED';
                      return (
                        <button
                          key={node.id}
                          onClick={() => setSelectedPromptNodeId(node.id)}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            active
                              ? isBlocked ? 'border-rose-500 bg-rose-500 text-white' : 'border-primary bg-primary text-primary-foreground'
                              : isBlocked ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <span className="block text-xs font-bold">{node.id}</span>
                          <span className="mt-0.5 block text-[10px]">{configText(node, 'label', 'name') || node.id}</span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedPromptNode && (
                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-[10px] text-muted-foreground">支持度门槛</div>
                        <div className="mt-1 text-sm font-semibold text-foreground">{configNumber(selectedPromptNode, 'supportThreshold', 'support') ?? '—'}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">当前节点要求</div>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-[10px] text-muted-foreground">有效接触次数</div>
                        <div className="mt-1 text-sm font-semibold text-foreground">{configNumber(selectedPromptNode, 'contactThreshold', 'effectiveContactThreshold', 'contacts') ?? '—'}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">仅计入有效接触</div>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-[10px] text-muted-foreground">证据标签</div>
                        <div className="mt-1 text-xs leading-5 text-foreground">{configList(selectedPromptNode, 'evidenceTags', 'evidence', 'requiredEvidence').join('、') || '无额外标签'}</div>
                      </div>
                      <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3">
                        <div className="text-[10px] text-rose-700">阻断条件</div>
                        <div className="mt-1 text-xs leading-5 text-rose-900">{configText(selectedPromptNode, 'blockerPolicy', 'blockers', 'blockingRule') || '活动阻断优先，阻断未解除前不升级。'}</div>
                      </div>
                    </div>
                  )}
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-foreground">运行时双轴状态</div>
                      <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">预览初始值</span>
                    </div>
                    <div className="mt-4 space-y-4">
                      {[
                        ['support', '支持度', '支持意愿的运行时轴', 'bg-primary', '48%'],
                        ['pleasantness', '愉悦度', '互动感受的运行时轴', 'bg-amber-500', '56%'],
                      ].map((axis) => (
                        <div key={axis[0]}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground">{axis[1]}</span>
                            <span className="font-mono text-muted-foreground">{axis[4]}</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-muted">
                            <div className={`h-2 rounded-full ${axis[3]}`} style={{ width: axis[4] }} />
                          </div>
                          <div className="mt-1 text-[10px] text-muted-foreground">{axis[2]}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-muted/60 p-3"><span className="text-muted-foreground">有效接触</span><span className="float-right font-semibold text-foreground">1 次</span></div>
                      <div className="rounded-lg bg-muted/60 p-3"><span className="text-muted-foreground">活动阻断</span><span className="float-right font-semibold text-success">无</span></div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-5">
                    <div className="text-sm font-semibold text-foreground">高价值记忆 · 近期历史</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-[10px] font-semibold text-foreground">高价值记忆</div>
                        <div className="mt-2 space-y-1.5 text-xs leading-5 text-muted-foreground">
                          {configList(selectedPromptNpc, 'highValueMemory', 'memoryFocus', 'memories').length > 0
                            ? configList(selectedPromptNpc, 'highValueMemory', 'memoryFocus', 'memories').map((memory) => <div key={memory}>• {memory}</div>)
                            : <div>仅保留带来源的事实、承诺、证据和阻断。</div>}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="text-[10px] font-semibold text-foreground">近期历史</div>
                        <div className="mt-2 text-xs leading-5 text-muted-foreground">
                          {configText(selectedPromptNpc, 'recentHistory', 'historyPolicy') || '只注入该人物最近有限对话；原始流水保留在日志，不全量进入提示词。'}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-[11px] leading-5 text-blue-900">
                      记忆先结构化索引，再筛选必须提及或可引用摘要；跨人物信息不得因历史文本自动共享。
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">渠道修饰器 · 人物×渠道例外</div>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">每次接触是独立动作；渠道只修饰表达方式，不能覆盖人物规则、状态门槛或阻断。</p>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] text-muted-foreground">{promptChannels.length} 个渠道修饰器</span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {promptChannels.map((channel) => (
                      <div key={channel.key} className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">{channel.label}</span>
                          <code className="text-[10px] text-muted-foreground">{channel.key}</code>
                        </div>
                        <div className="mt-1 text-xs leading-5 text-muted-foreground">{channel.text || '共享配置中暂无描述。'}</div>
                      </div>
                    ))}
                    {promptChannels.length === 0 && <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">共享配置中暂无渠道修饰器。</div>}
                  </div>
                  <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="text-[10px] font-semibold text-primary">当前人物专属例外 · {selectedPromptNpc?.name}</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedNpcExceptions.map(([channel, exception]) => (
                        <div key={channel} className="rounded-md bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">
                          <span className="font-medium text-foreground">{channel}</span> · {configText(exception, 'description', 'exception', 'modifier', 'prompt', 'value') || '已配置人物专属表达边界。'}
                        </div>
                      ))}
                      {selectedNpcExceptions.length === 0 && <div className="text-xs text-muted-foreground">无专属例外，使用渠道通用修饰器。</div>}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-card">
                  <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Pencil className="h-4 w-4 text-primary" /> 系统提示词结构预览</div>
                    <span className="text-[10px] text-muted-foreground">{selectedPromptNpc?.name || '未选择'} · {configText(selectedPromptNode, 'label', 'name') || selectedPromptNode?.id || '未选择节点'}</span>
                    <div className="ml-auto flex items-center gap-1 rounded-lg bg-muted p-1">
                      <button onClick={() => setPromptView('edit')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${promptView === 'edit' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>单层查看</button>
                      <button onClick={() => setPromptView('preview')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${promptView === 'preview' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>预览</button>
                    </div>
                  </div>
                  <div className="grid min-h-[500px] lg:grid-cols-[210px_1fr]">
                    <div className="border-b border-border p-3 lg:border-b-0 lg:border-r">
                      <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">组合顺序</div>
                      <div className="space-y-1">
                        {orderedPromptLayers.map((layer, index) => {
                          const active = selectedPromptLayer?.id === layer.id;
                          return (
                            <button
                              key={layer.id}
                              onClick={() => { setSelectedPromptLayerId(layer.id); setPromptView('edit'); }}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors ${active ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/80 text-[10px] font-bold">{index + 1}</span>
                              <span className="truncate">{configText(layer, 'label', 'name') || layer.id}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-4 rounded-lg bg-muted/60 p-3 text-[10px] leading-5 text-muted-foreground">
                        顺序固定为：硬约束 → 人物规则 → 状态节点 → 运行时双轴状态 → 高价值记忆 → 近期历史 → 渠道修饰器 → 人物×渠道例外。
                      </div>
                    </div>
                    <div className="p-4">
                      {selectedPromptLayer ? (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-foreground">{configText(selectedPromptLayer, 'label', 'name') || selectedPromptLayer.id}</div>
                              <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{configText(selectedPromptLayer, 'description') || '该层由共享配置定义，可针对当前人物与状态调整表达。'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => router.push('/designer/prompt-library')}
                                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                              >
                                <Library className="h-3.5 w-3.5" /> 编辑人物提示词
                              </button>
                              <button
                                onClick={() => { if (selectedPromptLayerText) void navigator.clipboard.writeText(selectedPromptLayerText); }}
                                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                              >
                                <Copy className="h-3.5 w-3.5" /> 复制
                              </button>
                            </div>
                          </div>
                          {promptView === 'edit' ? (
                            <textarea
                              value={selectedPromptLayerText}
                              readOnly
                              placeholder="共享配置中暂无模板。"
                              className="mt-4 h-[350px] w-full resize-none rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          ) : (
                            <div className="mt-4 h-[350px] overflow-auto rounded-lg border border-border bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                              {promptPreview.length > 0 ? promptPreview.map((section) => (
                                <div key={section.id} className="mb-4 last:mb-0">
                                  <div className="mb-1 font-semibold text-blue-300">## {section.label}</div>
                                  <div className="whitespace-pre-wrap break-words text-slate-200">{section.text}</div>
                                </div>
                              )) : <div className="text-slate-400">共享配置中暂无可预览内容。</div>}
                            </div>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                            <span className="rounded-full bg-muted px-2 py-1">人物：{selectedPromptNpc?.id || '—'}</span>
                            <span className="rounded-full bg-muted px-2 py-1">节点：{selectedPromptNode?.id || '—'}</span>
                            <span className="rounded-full bg-muted px-2 py-1">Evaluator：独立上下文</span>
                            <span className="rounded-full bg-muted px-2 py-1">Resolver：代码结算</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">共享分层配置尚未提供。</div>
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {selectedModule === 'data' && selectedDataTab === 'metrics' && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> 指标体系
              <span className="text-[10px] text-muted-foreground font-normal ml-auto">A/B/C 三级指标体系</span>
            </div>

            {/* 指标分类 Tab */}
            <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
              {metricTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedMetricTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedMetricTab === tab
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* A/B/C 类指标通用渲染 */}
            {['A类基础指标', 'B类中级指标', 'C类高级指标'].includes(selectedMetricTab) && (
              <div className="space-y-3">
                {/* 新增按钮 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {selectedMetricTab === 'A类基础指标' && `共 ${a.length} 项`}
                    {selectedMetricTab === 'B类中级指标' && `共 ${b.length} 项`}
                    {selectedMetricTab === 'C类高级指标' && `共 ${c.length} 项`}
                  </span>
                  <button
                    onClick={() => { setShowAddForm(!showAddForm); setEditingMetric(null); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> 新增指标
                  </button>
                </div>

                {/* 新增表单 */}
                {showAddForm && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                      <input
                        value={addForm.tag}
                        onChange={(e) => setAddForm({...addForm, tag: e.target.value})}
                        placeholder="标签 (如 A68)"
                        className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <input
                        value={addForm.name}
                        onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                        placeholder="指标名称"
                        className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <input
                        value={addForm.desc}
                        onChange={(e) => setAddForm({...addForm, desc: e.target.value})}
                        placeholder="描述"
                        className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <input
                        value={addForm.value}
                        onChange={(e) => setAddForm({...addForm, value: e.target.value})}
                        placeholder={selectedMetricTab === 'A类基础指标' ? '初始值' : '公式'}
                        className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={addForm.category}
                        onChange={(e) => setAddForm({...addForm, category: e.target.value})}
                        placeholder="分类 (可选)"
                        className="flex-1 px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button onClick={handleAddMetric} className="px-4 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">保存</button>
                      <button onClick={() => { setShowAddForm(false); setAddForm({ tag: '', name: '', desc: '', value: '', category: '' }); }} className="px-4 py-2 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">取消</button>
                    </div>
                  </div>
                )}

                {/* 指标列表 */}
                <div className="space-y-2 max-h-[450px] overflow-y-auto pr-2">
                  {selectedMetricTab === 'A类基础指标' && a.map((item) => (
                    <div key={item.tag} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted border border-border group">
                      {editingMetric === item.tag ? (
                        <>
                          <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded min-w-[40px] text-center">{item.tag}</span>
                          <input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="flex-1 px-2 py-1 rounded bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[120px]" />
                          <input value={editForm.desc} onChange={(e) => setEditForm({...editForm, desc: e.target.value})} className="flex-1 px-2 py-1 rounded bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="描述" />
                          <input value={editForm.value} onChange={(e) => setEditForm({...editForm, value: e.target.value})} className="w-20 px-2 py-1 rounded bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-right" placeholder="初始值" />
                          <button onClick={handleSaveEdit} className="p-1.5 rounded hover:bg-success/10 text-success transition-colors"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingMetric(null)} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-mono font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded min-w-[40px] text-center">{item.tag}</span>
                          <span className="text-sm font-medium text-foreground min-w-[120px]">{item.name}</span>
                          <span className="flex-1 text-xs text-muted-foreground">{item.desc}</span>
                          <span className="text-xs text-muted-foreground min-w-[60px] text-right">初始值: {item.init}</span>
                          {item.category && <span className="text-[10px] text-warning bg-warning/10 px-2 py-0.5 rounded">{item.category}</span>}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditMetric(item.tag, item.name, item.desc, item.init)} className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteMetric(item.tag)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {selectedMetricTab === 'B类中级指标' && b.map((item) => (
                    <div key={item.tag} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted border border-border group">
                      {editingMetric === item.tag ? (
                        <>
                          <span className="text-xs font-mono font-semibold text-success bg-success/10 px-2 py-0.5 rounded min-w-[40px] text-center">{item.tag}</span>
                          <input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="flex-1 px-2 py-1 rounded bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[100px]" />
                          <input value={editForm.desc} onChange={(e) => setEditForm({...editForm, desc: e.target.value})} className="flex-1 px-2 py-1 rounded bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="描述" />
                          <input value={editForm.value} onChange={(e) => setEditForm({...editForm, value: e.target.value})} className="w-48 px-2 py-1 rounded bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono" placeholder="公式" />
                          <button onClick={handleSaveEdit} className="p-1.5 rounded hover:bg-success/10 text-success transition-colors"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingMetric(null)} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-mono font-semibold text-success bg-success/10 px-2 py-0.5 rounded min-w-[40px] text-center">{item.tag}</span>
                          <span className="text-sm font-medium text-foreground min-w-[100px]">{item.name}</span>
                          <span className="flex-1 text-xs text-muted-foreground">{item.desc}</span>
                          <code
                            className="text-[10px] text-primary bg-primary/5 px-2 py-0.5 rounded font-mono min-w-[180px] text-right truncate cursor-pointer hover:bg-primary/10 transition-colors"
                            title={item.formula}
                            onClick={() => { setFormulaModalData({ tag: item.tag, name: item.name, formula: item.formula }); setShowFormulaModal(true); }}
                          >{item.formula}</code>
                          {item.category && <span className="text-[10px] text-warning bg-warning/10 px-2 py-0.5 rounded">{item.category}</span>}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditMetric(item.tag, item.name, item.desc, item.formula)} className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteMetric(item.tag)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {selectedMetricTab === 'C类高级指标' && c.map((item) => (
                    <div key={item.tag} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted border border-border group">
                      {editingMetric === item.tag ? (
                        <>
                          <span className="text-xs font-mono font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded min-w-[40px] text-center">{item.tag}</span>
                          <input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="flex-1 px-2 py-1 rounded bg-card border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[120px]" />
                          <input value={editForm.desc} onChange={(e) => setEditForm({...editForm, desc: e.target.value})} className="flex-1 px-2 py-1 rounded bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="描述" />
                          <input value={editForm.value} onChange={(e) => setEditForm({...editForm, value: e.target.value})} className="w-48 px-2 py-1 rounded bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono" placeholder="公式" />
                          <button onClick={handleSaveEdit} className="p-1.5 rounded hover:bg-success/10 text-success transition-colors"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingMetric(null)} className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-mono font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded min-w-[40px] text-center">{item.tag}</span>
                          <span className="text-sm font-medium text-foreground min-w-[120px]">{item.name}</span>
                          <span className="flex-1 text-xs text-muted-foreground">{item.desc}</span>
                          <code
                            className="text-[10px] text-destructive bg-destructive/5 px-2 py-0.5 rounded font-mono min-w-[180px] text-right truncate cursor-pointer hover:bg-destructive/10 transition-colors"
                            title={item.formula}
                            onClick={() => {
                              setFormulaModalData({ tag: item.tag, name: item.name, formula: item.formula });
                              setShowFormulaModal(true);
                            }}
                          >{item.formula}</code>
                          {item.category && <span className="text-[10px] text-warning bg-warning/10 px-2 py-0.5 rounded">{item.category}</span>}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditMetric(item.tag, item.name, item.desc, item.formula)} className="p-1.5 rounded hover:bg-primary/10 text-primary transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteMetric(item.tag)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 其他分类 Tab 内容 */}
            {!['A类基础指标', 'B类中级指标', 'C类高级指标'].includes(selectedMetricTab) && (
              <div className="text-sm text-muted-foreground text-center py-8">
                {selectedMetricTab} 指标配置区域
              </div>
            )}
          </div>
        )}

        {/* 公式编辑大弹窗 */}
        {showFormulaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowFormulaModal(false)}>
            <div className="bg-card rounded-2xl shadow-2xl w-[600px] max-w-[90vw] p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">编辑公式</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono text-destructive">{formulaModalData.tag}</span>
                    <span className="mx-1.5">·</span>
                    {formulaModalData.name}
                  </p>
                </div>
                <button onClick={() => setShowFormulaModal(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <textarea
                value={formulaModalData.formula}
                onChange={(e) => setFormulaModalData({ ...formulaModalData, formula: e.target.value })}
                placeholder="输入公式，如 (A01 + A02) / A03 * 100"
                rows={6}
                className="w-full px-4 py-3 rounded-xl bg-surface-container border-none text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowFormulaModal(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-surface-container">
                  取消
                </button>
                <button
                  onClick={() => { handleSaveFormulaModal(); setShowFormulaModal(false); }}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
