'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Building2, Users, FileText, Save, ArrowLeft, UserCog, BarChart3, Plus, Trash2, Pencil, X, LogOut, ShieldCheck, FlaskConical, Library, Database, ImageIcon, FileBarChart, TestTube2, PlayCircle, ClipboardList, Upload, Sparkles, FolderOpen } from 'lucide-react';
import { aMetrics, bMetrics, cMetrics } from '@/lib/metrics-data';
import { PROJECT_ONE_FIVE_PERSON_NPCS } from '@/lib/designer/project-one-five-person';
import { ROLE_COLOR, ROLE_LABEL } from '@/components/app-shell';

type DesignerImageAssetCategory = 'person_intro' | 'person_expression' | 'visit_scene';

interface DesignerImageAsset {
  slotKey: string;
  category: DesignerImageAssetCategory;
  personId: string | null;
  label: string;
  imageUrl: string | null;
  isDefault: boolean;
  updatedAt: string | null;
}

type ConfigRecord = Record<string, unknown>;

interface FivePersonNpcConfig extends ConfigRecord {
  id: string;
  name: string;
  title?: string;
  parentId?: string | null;
  displayOrder?: number;
  displayLevel?: number;
}

function configRecords(value: unknown): ConfigRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is ConfigRecord => Boolean(item && typeof item === 'object'));
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as ConfigRecord).map(([id, item]) => ({
    id,
    ...(item && typeof item === 'object' ? item : { value: item }),
  }));
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

const fivePersonNpcs = configRecords(PROJECT_ONE_FIVE_PERSON_NPCS) as FivePersonNpcConfig[];

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
  const [selectedModule, setSelectedModule] = useState<'assets' | 'data' | 'reports' | 'testing'>('assets');
  const [selectedDataTab, setSelectedDataTab] = useState<'project' | 'competitors' | 'metrics'>('project');
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
  const [imageAssets, setImageAssets] = useState<DesignerImageAsset[]>([]);
  const [imageAssetsLoading, setImageAssetsLoading] = useState(true);
  const [imageAssetNotice, setImageAssetNotice] = useState('');
  const [uploadingImageSlot, setUploadingImageSlot] = useState<string | null>(null);
  const [previewImageAsset, setPreviewImageAsset] = useState<DesignerImageAsset | null>(null);

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

  useEffect(() => {
    fetch('/api/designer/image-assets')
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || '图片素材读取失败');
        setImageAssets(Array.isArray(body.assets) ? body.assets : []);
      })
      .catch((error) => setImageAssetNotice(error instanceof Error ? error.message : '图片素材读取失败'))
      .finally(() => setImageAssetsLoading(false));
  }, []);

  useEffect(() => {
    if (!previewImageAsset) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewImageAsset(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [previewImageAsset]);

  const currentProject = projects.find(p => p.id === selectedProject);
  const currentCompetitors = competitors.filter(c => c.project_id === selectedProject);

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

  const handleImageUpload = async (slotKey: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingImageSlot(slotKey);
    setImageAssetNotice('');
    try {
      const token = window.localStorage.getItem('weixun_session') || '';
      const form = new FormData();
      form.append('slotKey', slotKey);
      form.append('file', file);
      const response = await fetch('/api/designer/image-assets', { method: 'POST', headers: { 'x-session': token }, body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || '图片上传失败');
      const asset = body.asset as DesignerImageAsset;
      setImageAssets((current) => current.map((item) => item.slotKey === asset.slotKey ? asset : item));
      setImageAssetNotice(`已更新「${asset.label}」。`);
    } catch (error) {
      setImageAssetNotice(error instanceof Error ? error.message : '图片上传失败');
    } finally {
      setUploadingImageSlot(null);
    }
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
        <nav aria-label="设计师工作区" className="mb-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { id: 'assets' as const, label: '素材库', hint: '人物、图片与拜访场景', icon: Library },
            { id: 'data' as const, label: '数据', hint: '项目、竞品与指标', icon: Database },
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
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">集中管理人物资料、人物提示词、人物图片和拜访场景图片。</p>
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

              <div className="rounded-xl border border-role-designer/30 bg-role-designer/5 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-role-designer/10 text-role-designer"><ImageIcon className="h-5 w-5" /></span>
                  <span className="rounded-full bg-role-designer/10 px-2 py-1 text-[10px] text-role-designer">已开放</span>
                </div>
                <div className="text-sm font-semibold text-foreground">人物图片素材</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">人物介绍图已预填；可上传替换介绍图或补充五种表情。</p>
                <div className="mt-4 text-xs font-medium text-role-designer">在下方按用途上传 →</div>
              </div>
            </div>

            <section className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">人物形象</h3>
                  <p className="mt-1 text-xs text-muted-foreground">支持 PNG、JPEG、WebP，单张不超过 5 MB。人物介绍图用于游戏主进程页面。</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{imageAssets.filter((asset) => asset.category === 'person_intro').length}/5 介绍图</span>
              </div>
              {imageAssetNotice && <p role="status" className="mb-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{imageAssetNotice}</p>}
              {imageAssetsLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">正在读取图片素材…</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {imageAssets.filter((asset) => asset.category === 'person_intro').map((asset) => (
                    <article key={asset.slotKey} className="overflow-hidden rounded-lg border border-border bg-muted/30">
                      <div className="h-32 bg-muted">
                        {asset.imageUrl ? <button type="button" onClick={() => setPreviewImageAsset(asset)} className="h-full w-full cursor-zoom-in" aria-label={`查看${asset.label}高清大图`}><img src={asset.imageUrl} alt={asset.label} className="h-full w-full object-cover object-top" /></button> : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">暂未上传</div>}
                      </div>
                      <div className="p-3">
                        <div className="min-h-9 text-xs font-medium text-foreground">{asset.label}</div>
                        <label className="mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground hover:bg-muted">
                          <Upload className="h-3.5 w-3.5" /> {uploadingImageSlot === asset.slotKey ? '上传中…' : asset.isDefault ? '替换图片' : '再次替换'}
                          <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingImageSlot !== null} onChange={(event) => void handleImageUpload(asset.slotKey, event)} />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {!imageAssetsLoading && (
              <section className="rounded-xl border border-border bg-card p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-foreground">人物表情</h3>
                  <p className="mt-1 text-xs text-muted-foreground">愤怒、严肃、正常淡定、愉快、特别开心五种表情初始为空，可按人物分别上传。</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {imageAssets.filter((asset) => asset.category === 'person_expression').map((asset) => (
                    <article key={asset.slotKey} className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/25 p-2 hover:border-role-designer/50 hover:bg-role-designer/5">
                      {asset.imageUrl ? <button type="button" onClick={() => setPreviewImageAsset(asset)} className="h-10 w-10 shrink-0 cursor-zoom-in overflow-hidden rounded" aria-label={`查看${asset.label}高清大图`}><img src={asset.imageUrl} alt={asset.label} className="h-full w-full object-cover" /></button> : <ImageIcon className="h-5 w-5 shrink-0 text-muted-foreground" />}
                      <span className="min-w-0 flex-1 text-xs text-foreground">{asset.label}</span>
                      <label className="cursor-pointer rounded p-1 text-role-designer hover:bg-role-designer/10" aria-label={`上传${asset.label}`}>
                        <Upload className="h-3.5 w-3.5" />
                        <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingImageSlot !== null} onChange={(event) => void handleImageUpload(asset.slotKey, event)} />
                      </label>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">素材使用说明</span>
              </div>
              <div className="grid gap-3 text-xs leading-5 text-muted-foreground md:grid-cols-3">
                <div className="rounded-lg bg-muted/60 p-3"><span className="font-medium text-foreground">人物资料</span><br />用于维护人物主档和游戏中的可披露信息。</div>
                <div className="rounded-lg bg-muted/60 p-3"><span className="font-medium text-foreground">人物提示词</span><br />按人物和交流渠道维护角色表达，规则性约束不开放编辑。</div>
                <div className="rounded-lg bg-muted/60 p-3"><span className="font-medium text-foreground">图片素材</span><br />人物介绍图已预填，表情与拜访场景可在对应槽位上传。</div>
              </div>
            </div>
          </div>
        )}

        {selectedModule === 'assets' && (
          <div className="space-y-4 animate-fade-up">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">拜访场景图片</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">办公室、饭店、电梯和酒馆均从空素材位开始，可在此上传并替换。</p>
                </div>
                <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">PNG、JPEG、WebP · 5 MB 以内</span>
              </div>
              {imageAssetNotice && <p role="status" className="mb-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{imageAssetNotice}</p>}
              {imageAssetsLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">正在读取场景素材…</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {imageAssets.filter((asset) => asset.category === 'visit_scene').map((asset) => (
                    <article key={asset.slotKey} className="overflow-hidden rounded-xl border border-dashed border-border bg-muted/25">
                      <div className="h-40 bg-muted">
                        {asset.imageUrl ? <button type="button" onClick={() => setPreviewImageAsset(asset)} className="h-full w-full cursor-zoom-in" aria-label={`查看${asset.label}高清大图`}><img src={asset.imageUrl} alt={asset.label} className="h-full w-full object-cover" /></button> : <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"><ImageIcon className="h-7 w-7" /><span className="text-xs">暂未上传</span></div>}
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-semibold text-foreground">{asset.label}</h3>
                        <label className="mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground hover:bg-muted">
                          <Upload className="h-3.5 w-3.5" /> {uploadingImageSlot === asset.slotKey ? '上传中…' : asset.imageUrl ? '替换图片' : '上传图片'}
                          <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingImageSlot !== null} onChange={(event) => void handleImageUpload(asset.slotKey, event)} />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              )}
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

        {previewImageAsset?.imageUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`${previewImageAsset.label}高清大图`}
            onClick={() => setPreviewImageAsset(null)}
          >
            <div className="relative flex max-h-[92vh] max-w-[94vw] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
                <div className="min-w-0 truncate text-sm font-semibold text-foreground">{previewImageAsset.label}</div>
                <button type="button" onClick={() => setPreviewImageAsset(null)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="关闭高清大图">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex min-h-0 items-center justify-center overflow-auto bg-black/90 p-3">
                <img src={previewImageAsset.imageUrl} alt={previewImageAsset.label} className="max-h-[82vh] max-w-full object-contain" />
              </div>
            </div>
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
