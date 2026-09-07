'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Building2, Users, FileText, Save, ArrowLeft, Megaphone, UserCog, BarChart3, Copy, Plus, Trash2, Pencil, X, LogOut, ShieldCheck, FlaskConical, Library, Database, ImageIcon, FileBarChart, TestTube2, PlayCircle, ClipboardList, Upload, Sparkles, FolderOpen } from 'lucide-react';
import { aMetrics, bMetrics, cMetrics } from '@/lib/metrics-data';
import { projectNames, keyPeopleByProject as keyPeopleByProjectData } from '@/lib/key-people-data';
import { ROLE_COLOR, ROLE_LABEL } from '@/components/app-shell';

interface KeyPerson {
  id: number;
  name: string;
  title: string;
  gender: string;
  age: number;
  hometown: string;
  personality: string;
  weakness: string;
}

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
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
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
  const [selectedStage, setSelectedStage] = useState(0);
  const [selectedKeyPerson, setSelectedKeyPerson] = useState(0);
  const [keyPeopleData, setKeyPeopleData] = useState(keyPeopleByProjectData);
  const [scenarioStages, setScenarioStages] = useState([
    {
      name: '第一次见面',
      subPrompts: [
        { id: '1-1', name: '开场与寒暄', text: '', summary: '' },
        { id: '1-2', name: '提问与质疑', text: '', summary: '' },
        { id: '1-3', name: '聊嗨了', text: '', summary: '' },
        { id: '1-4', name: '不爽', text: '', summary: '' },
      ],
    },
    {
      name: '第二次沟通',
      subPrompts: [
        { id: '2-1', name: '开场寒暄', text: '', summary: '' },
        { id: '2-2', name: '提问质疑', text: '', summary: '' },
        { id: '2-3', name: '聊嗨了', text: '', summary: '' },
        { id: '2-4', name: '不太爽', text: '', summary: '' },
      ],
    },
    {
      name: '持续沟通',
      subPrompts: [
        { id: '3-1', name: '开场寒暄', text: '', summary: '' },
        { id: '3-2', name: '提问质疑', text: '', summary: '' },
        { id: '3-3', name: '聊嗨了', text: '', summary: '' },
        { id: '3-4', name: '不太爽', text: '', summary: '' },
      ],
    },
    {
      name: '铁杆同盟',
      subPrompts: [
        { id: '4-1', name: '开场寒暄', text: '', summary: '' },
        { id: '4-2', name: '提问质疑', text: '', summary: '' },
        { id: '4-3', name: '聊嗨了', text: '', summary: '' },
        { id: '4-4', name: '不太爽', text: '', summary: '' },
      ],
    },
    {
      name: '喝酒',
      subPrompts: [
        { id: '5-1', name: '开场寒暄', text: '', summary: '' },
        { id: '5-2', name: '提问质疑', text: '', summary: '' },
        { id: '5-3', name: '聊嗨了', text: '', summary: '' },
        { id: '5-4', name: '不太爽', text: '', summary: '' },
      ],
    },
  ]);
  const [selectedSubPrompt, setSelectedSubPrompt] = useState(0);

  useEffect(() => {
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
            keyPersons: [],
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
            keyPersons: personsByProject[p.id] || [],
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                onClick={() => router.push('/designer/eval-prompts')}
                className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><Megaphone className="h-5 w-5" /></span>
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">提示词</span>
                </div>
                <div className="text-sm font-semibold text-foreground">人物评估提示词</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">配置玩家表现评估和人物反馈所使用的提示词。</p>
                <div className="mt-4 text-xs font-medium text-primary">打开提示词配置 →</div>
              </button>

              <button
                onClick={() => router.push('/designer/dialogue-prompts')}
                className="group rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-violet-400/60 hover:shadow-md"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600"><FlaskConical className="h-5 w-5" /></span>
                  <span className="rounded-full bg-violet-500/10 px-2 py-1 text-[10px] text-violet-600">模型</span>
                </div>
                <div className="text-sm font-semibold text-foreground">人物对话提示词</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">管理张建国当面拜访的对话提示词和测试剧本。</p>
                <div className="mt-4 text-xs font-medium text-violet-600">打开模型回复测试 →</div>
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
                <div className="rounded-lg bg-muted/60 p-3"><span className="font-medium text-foreground">人物提示词</span><br />分为评估提示词与对话提示词，按用途独立维护。</div>
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
          <div className="bg-card rounded-xl border border-border mb-6">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">场景提示词配置</span>
              <span className="text-[10px] text-muted-foreground ml-auto">5 阶段 × 4 场景</span>
            </div>

            {/* Project & Key Persons Row */}
            <div className="px-6 py-3 border-b border-border bg-muted/30">
              {/* Project selector */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-foreground">项目</span>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {projectNames.map((name, i) => (
                    <button
                      key={i}
                      onClick={() => { setSelectedProject(i); setSelectedKeyPerson(0); }}
                      className={`px-3 py-1 rounded text-xs transition-all whitespace-nowrap ${
                        selectedProject === i
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'bg-card text-muted-foreground hover:bg-muted border border-border'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
              {/* Key persons */}
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">关键人</span>
                <span className="text-[10px] text-muted-foreground ml-2">选择关键人后，配置与该人沟通的 5 阶段 × 4 场景提示词</span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto mt-1">
                {(keyPeopleData[selectedProject] || []).map((person, i) => (
                  <button
                    key={person.name}
                    onClick={() => setSelectedKeyPerson(i)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all whitespace-nowrap ${
                      selectedKeyPerson === i
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      selectedKeyPerson === i
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {person.name[0]}
                    </div>
                    <span>{person.name}</span>
                    <span className={`text-[10px] ${
                      selectedKeyPerson === i ? 'text-primary-foreground/70' : 'text-muted-foreground/60'
                    }`}>
                      {person.role}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    const newPerson = { name: '新关键人', role: '职位', personality: '', weakness: '' };
                    setKeyPeopleData(prev => prev.map((project: typeof prev[0], i: number) => {
                      if (i !== selectedProject) return project;
                      return [...project, newPerson];
                    }));
                    setSelectedKeyPerson(keyPeopleData[selectedProject].length);
                  }}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-dashed border-border"
                >
                  <Plus className="w-3 h-3" /> 添加
                </button>
              </div>
            </div>

            <div className="flex min-h-[500px]">
              {/* Left: Stage tabs */}
              <div className="w-[160px] border-r border-border p-3 space-y-1">
                {scenarioStages.map((stage, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedStage(i); setSelectedSubPrompt(0); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                      selectedStage === i
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                      {stage.name}
                    </div>
                  </button>
                ))}
              </div>

              {/* Middle: Sub-prompt tabs */}
              <div className="w-[180px] border-r border-border p-3 space-y-1">
                <div className="text-[10px] text-muted-foreground mb-2 px-2 font-medium uppercase tracking-wider">沟通情境</div>
                {(scenarioStages[selectedStage]?.subPrompts || []).map((sp, j) => (
                  <div key={sp.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => setSelectedSubPrompt(j)}
                      className={`flex-1 text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                        selectedSubPrompt === j
                          ? 'bg-amber-500/10 text-amber-600 font-semibold border border-amber-500/20'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {sp.name}
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { if (sp.text) navigator.clipboard.writeText(sp.text); }}
                        className="p-1 rounded hover:bg-primary/10 text-primary transition-colors"
                        title="复制"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (!scenarioStages[selectedStage] || scenarioStages[selectedStage].subPrompts.length <= 1) return;
                          setScenarioStages(prev => prev.map((stage, i) => {
                            if (i !== selectedStage) return stage;
                            const newSubPrompts = stage.subPrompts.filter((_, k) => k !== j);
                            return { ...stage, subPrompts: newSubPrompts };
                          }));
                          setSelectedSubPrompt(Math.max(0, selectedSubPrompt - 1));
                        }}
                        className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                        title="修改"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* 新增按钮 - 放在最后 */}
                <button
                  onClick={() => {
                    setScenarioStages(prev => prev.map((stage, i) => {
                      if (i !== selectedStage) return stage;
                      const newSubPrompts = [...stage.subPrompts];
                      const newId = `${selectedStage + 1}-${Date.now()}`;
                      newSubPrompts.push({ id: newId, name: '新提示词', text: '', summary: '' });
                      return { ...stage, subPrompts: newSubPrompts };
                    }));
                    setSelectedSubPrompt(scenarioStages[selectedStage]?.subPrompts.length || 0);
                  }}
                  className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-dashed border-border mt-1"
                >
                  <Plus className="w-3 h-3" /> 新增情境
                </button>

                {/* Summary section */}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-[10px] text-muted-foreground mb-2 px-2 font-medium">对话汇总</div>
                  <div className="px-2 text-[11px] text-muted-foreground leading-relaxed">
                    {(scenarioStages[selectedStage]?.subPrompts || []).some(sp => sp.summary)
                      ? scenarioStages[selectedStage]?.subPrompts.find(sp => sp.summary)?.summary || '暂无汇总'
                      : '沟通后自动生成'}
                  </div>
                </div>
              </div>

              {/* Right: Prompt editor */}
              <div className="flex-1 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground">
                    {scenarioStages[selectedStage]?.name || ''} / {scenarioStages[selectedStage]?.subPrompts[selectedSubPrompt]?.name || ''}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors"
                    >
                      保存
                    </button>
                  </div>
                </div>
                <textarea
                  value={scenarioStages[selectedStage]?.subPrompts[selectedSubPrompt]?.text || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScenarioStages(prev => prev.map((stage, i) => {
                      if (i !== selectedStage) return stage;
                      const newSubPrompts = [...stage.subPrompts];
                      newSubPrompts[selectedSubPrompt] = { ...newSubPrompts[selectedSubPrompt], text: val };
                      return { ...stage, subPrompts: newSubPrompts };
                    }));
                  }}
                  placeholder="输入提示词内容..."
                  className="w-full h-[380px] px-4 py-3 rounded-lg border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </div>
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
