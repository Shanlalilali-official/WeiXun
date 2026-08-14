'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Building2, Users, FileText, Save, ArrowLeft, Megaphone, UserCog, BarChart3, Copy, Plus, Trash2, Pencil, X, LogOut, ShieldCheck } from 'lucide-react';
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
  [key: string]: any;
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

export default function DesignerPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [selectedProject, setSelectedProject] = useState<number>(1);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModule, setSelectedModule] = useState<'client' | 'vendor' | 'scenario' | 'metrics' | null>('client');
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
          setProjects(d.data.map((p: any) => ({
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
          d.data.forEach((npc: any) => {
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

  const handleSave = async () => {
    alert('配置已保存（功能开发中）');
  };

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
                <div className="text-[10px] text-muted-foreground">配置甲方 · 乙方 · 场景 · AI 提示词</div>
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
              onClick={handleSave}
              className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" /> 保存配置
            </button>
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

        {/* 顶部三模块：甲方模块 | 乙方模块 | 场景 - 小方块样式 */}
        <div className="mb-6 flex items-center gap-4">
          <span className="text-sm font-semibold text-foreground">模块选择：</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedModule('client')}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                selectedModule === 'client'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              <Building2 className="w-4 h-4" /> 甲方模块
            </button>
            <button
              onClick={() => setSelectedModule('vendor')}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                selectedModule === 'vendor'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              <Users className="w-4 h-4" /> 乙方模块
            </button>
            <button
              onClick={() => setSelectedModule('scenario')}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                selectedModule === 'scenario'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              <FileText className="w-4 h-4" /> 场景
            </button>
            <button
              onClick={() => setSelectedModule('metrics')}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                selectedModule === 'metrics'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> 指标
            </button>
          </div>
        </div>

        {/* 根据选中的模块显示不同内容 */}
        {selectedModule === 'client' && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> 甲方模块配置
            </div>
            
            {/* 底部六入口 */}
            <div className="grid grid-cols-6 gap-4">
              {/* 甲方基本信息 */}
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

              {/* 关键人信息 */}
              <button
                onClick={() => router.push('/designer/key-persons')}
                className="bg-muted rounded-xl border border-border p-4 hover:border-primary/50 hover:shadow-md transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <UserCog className="w-5 h-5 text-primary" />
                </div>
                <div className="text-sm font-semibold text-foreground">关键人信息</div>
                <div className="text-[10px] text-muted-foreground mt-1">{currentProject?.keyPersons.length || 0} 人</div>
              </button>

              {/* AI评估提示词 */}
              <button
                onClick={() => router.push('/designer/eval-prompts')}
                className="bg-muted rounded-xl border border-border p-4 hover:border-primary/50 hover:shadow-md transition-all text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Megaphone className="w-5 h-5 text-primary" />
                </div>
                <div className="text-sm font-semibold text-foreground">AI评估提示词</div>
                <div className="text-[10px] text-muted-foreground mt-1">玩家评估</div>
              </button>

            </div>
          </div>
        )}

        {selectedModule === 'vendor' && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> 乙方模块配置
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

        {selectedModule === 'scenario' && (
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

        {selectedModule === 'metrics' && (
          <div className="bg-card rounded-xl border border-border p-6 mb-6">
            <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> 指标配置
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
