'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Users, BarChart3, Plus, Edit2, Trash2, Lock, Unlock,
  Play, FileText, Clock, CheckCircle2, XCircle, Settings,
  BookOpen, Package, Building2, History, Wand2, Eye, ChevronRight,
  X, Save, AlertTriangle, Copy, KeyRound
} from 'lucide-react';

interface Player {
  id: number;
  username: string;
  role: string;
  status: string;
  progress: string;
  joined_at: string;
}

interface LockConfig {
  client_unit: string;
  client_industry: string;
  vendor_product: string;
  scenario_locked: boolean;
  locked_at: string | null;
}

interface InitiateRecord {
  id: number;
  room_code: string;
  delegate_to_coach: boolean;
  allow_coach_view: boolean;
  status: string;
  created_at: string;
  player_count: number;
}

interface StudentReport {
  id: number;
  player_name: string;
  room_code: string;
  score: number;
  rounds: number;
  result: string;
  completed_at: string;
}

interface CustomItem {
  id: number;
  name: string;
  type: 'client' | 'product' | 'knowledge' | 'history';
  description: string;
  created_at: string;
}

export default function EnterpriseAdminPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'players' | 'progress' | 'lock' | 'initiate' | 'customize' | 'history'>('players');

  // Lock state
  const [lockConfig, setLockConfig] = useState<LockConfig>({
    client_unit: '',
    client_industry: '',
    vendor_product: '',
    scenario_locked: false,
    locked_at: null,
  });

  // 教练邀请码
  const [inviteCode, setInviteCode] = useState('');

  // Initiate state
  const [initiateRecords, setInitiateRecords] = useState<InitiateRecord[]>([]);
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [initiateDelegate, setInitiateDelegate] = useState(true);
  const [initiateCoachVisible, setInitiateCoachVisible] = useState(true);

  // Customize state
  const [customItems, setCustomItems] = useState<CustomItem[]>([]);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [customizeType, setCustomizeType] = useState<'client' | 'product' | 'knowledge' | 'history'>('client');
  const [customizeName, setCustomizeName] = useState('');
  const [customizeDesc, setCustomizeDesc] = useState('');

  // Progress drill-down state
  type ProgressView = 'overview' | 'classes' | 'class-detail' | 'person-detail' | 'all-people';
  const [progressView, setProgressView] = useState<ProgressView>('overview');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [peopleFilter, setPeopleFilter] = useState<'all' | 'completed' | 'partial' | 'logged'>('all');

  // Mock class data
  interface ClassData {
    id: string;
    name: string;
    note: string;
    time: string;
    status: 'in_progress' | 'completed';
    totalPeople: number;
    loggedPeople: number;
    completedPeople: number;
    partialPeople: number;
  }

  interface PersonDetail {
    id: string;
    classId: string;
    name: string;
    role: string;
    loginTime: string;
    startTime: string;
    stages: { name: string; completed: boolean; time?: string; attempts?: number }[];
    totalCompleted: number;
  }

  const [classData] = useState<ClassData[]>([
    { id: 'c1', name: '2024 Q1 销售精英班', note: '华东区销售团队培训', time: '2024-01-15 ~ 2024-03-15', status: 'in_progress', totalPeople: 50, loggedPeople: 30, completedPeople: 10, partialPeople: 20 },
    { id: 'c2', name: '2024 Q1 新人训练营', note: '新入职销售培训', time: '2024-02-01 ~ 2024-04-01', status: 'in_progress', totalPeople: 35, loggedPeople: 25, completedPeople: 5, partialPeople: 15 },
    { id: 'c3', name: '2024 Q2 管理层进阶班', note: '销售管理层专项', time: '2024-03-01 ~ 2024-05-01', status: 'in_progress', totalPeople: 20, loggedPeople: 18, completedPeople: 8, partialPeople: 10 },
    { id: 'c4', name: '2023 Q4 销售精英班', note: '华东区销售团队培训', time: '2023-10-15 ~ 2023-12-15', status: 'completed', totalPeople: 45, loggedPeople: 45, completedPeople: 40, partialPeople: 5 },
    { id: 'c5', name: '2023 Q4 新人训练营', note: '新入职销售培训', time: '2023-11-01 ~ 2024-01-01', status: 'completed', totalPeople: 30, loggedPeople: 30, completedPeople: 28, partialPeople: 2 },
  ]);

  const [personDetails] = useState<PersonDetail[]>([
    { id: 'p1', classId: 'c1', name: '张伟', role: '销售经理', loginTime: '2024-01-15 09:30', startTime: '2024-01-15 10:00', stages: [{ name: '第一次见面', completed: true, time: '2024-01-16 14:30', attempts: 2 }, { name: '第二次沟通', completed: true, time: '2024-01-20 11:00', attempts: 1 }, { name: '持续沟通', completed: true, time: '2024-02-01 15:00', attempts: 3 }, { name: '铁杆同盟', completed: true, time: '2024-02-15 10:30', attempts: 1 }], totalCompleted: 4 },
    { id: 'p2', classId: 'c1', name: '李娜', role: '销售主管', loginTime: '2024-01-15 10:15', startTime: '2024-01-15 11:00', stages: [{ name: '第一次见面', completed: true, time: '2024-01-17 09:00', attempts: 1 }, { name: '第二次沟通', completed: true, time: '2024-01-22 14:00', attempts: 2 }, { name: '持续沟通', completed: false, attempts: 0 }, { name: '铁杆同盟', completed: false, attempts: 0 }], totalCompleted: 2 },
    { id: 'p3', classId: 'c1', name: '王强', role: '销售代表', loginTime: '2024-01-16 08:45', startTime: '2024-01-16 09:00', stages: [{ name: '第一次见面', completed: true, time: '2024-01-18 16:00', attempts: 3 }, { name: '第二次沟通', completed: false, attempts: 0 }, { name: '持续沟通', completed: false, attempts: 0 }, { name: '铁杆同盟', completed: false, attempts: 0 }], totalCompleted: 1 },
    { id: 'p4', classId: 'c1', name: '赵敏', role: '销售总监', loginTime: '2024-01-15 08:00', startTime: '2024-01-15 09:00', stages: [{ name: '第一次见面', completed: true, time: '2024-01-15 15:00', attempts: 1 }, { name: '第二次沟通', completed: true, time: '2024-01-18 10:00', attempts: 1 }, { name: '持续沟通', completed: true, time: '2024-01-25 14:00', attempts: 2 }, { name: '铁杆同盟', completed: true, time: '2024-02-05 11:00', attempts: 1 }], totalCompleted: 4 },
    { id: 'p5', classId: 'c1', name: '陈晨', role: '销售代表', loginTime: '2024-01-17 14:20', startTime: '', stages: [{ name: '第一次见面', completed: false, attempts: 0 }, { name: '第二次沟通', completed: false, attempts: 0 }, { name: '持续沟通', completed: false, attempts: 0 }, { name: '铁杆同盟', completed: false, attempts: 0 }], totalCompleted: 0 },
  ]);

  // Student reports
  const [studentReports, setStudentReports] = useState<StudentReport[]>([]);

  // Edit player modal
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerForm, setPlayerForm] = useState({ username: '', role: 'player' });

  useEffect(() => {
    fetch('/api/enterprise/players')
      .then(r => r.json())
      .then(d => setPlayers(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load lock config
    fetch('/api/enterprise/lock')
      .then(r => r.json())
      .then(d => { if (d.data) setLockConfig(d.data); })
      .catch(() => {});

    // Load initiate records
    fetch('/api/enterprise/initiate')
      .then(r => r.json())
      .then(d => setInitiateRecords(d.data || []))
      .catch(() => {});

    // Load custom items
    fetch('/api/enterprise/customize')
      .then(r => r.json())
      .then(d => setCustomItems(d.data || []))
      .catch(() => {});

    // Load student reports
    fetch('/api/enterprise/reports')
      .then(r => {
        if (!r.ok) return { data: [] };
        return r.json();
      })
      .then(d => setStudentReports(d.data || []))
      .catch(() => {});
  }, []);

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setPlayerForm({ username: '', role: 'player' });
    setShowPlayerModal(true);
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setPlayerForm({ username: player.username, role: player.role });
    setShowPlayerModal(true);
  };

  const handleSavePlayer = async () => {
    if (!playerForm.username.trim()) return;
    try {
      if (editingPlayer) {
        const res = await fetch(`/api/enterprise/players?id=${editingPlayer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(playerForm),
        });
        const d = await res.json();
        if (d.data) setPlayers(players.map(p => p.id === editingPlayer.id ? d.data : p));
      } else {
        const res = await fetch('/api/enterprise/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(playerForm),
        });
        const d = await res.json();
        if (d.data) setPlayers([...players, d.data]);
      }
      setShowPlayerModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePlayer = async (id: number) => {
    if (!confirm('确定删除该玩家？')) return;
    try {
      await fetch(`/api/enterprise/players?id=${id}`, { method: 'DELETE' });
      setPlayers(players.filter(p => p.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveLock = async () => {
    try {
      const res = await fetch('/api/enterprise/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lockConfig, scenario_locked: true }),
      });
      const d = await res.json();
      if (d.data) setLockConfig(d.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnlock = async () => {
    try {
      const res = await fetch('/api/enterprise/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lockConfig, scenario_locked: false }),
      });
      const d = await res.json();
      if (d.data) setLockConfig(d.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateInviteCode = async () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const res = await fetch('/api/enterprise/invite-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.success) {
          setInviteCode(code);
        }
      } else {
        // API not available, just set the code locally
        setInviteCode(code);
      }
    } catch (e) {
      console.error(e);
      setInviteCode(code);
    }
  };

  const handleInitiate = async () => {
    try {
      const res = await fetch('/api/enterprise/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delegate_to_coach: initiateDelegate,
          allow_coach_view: initiateCoachVisible,
        }),
      });
      const d = await res.json();
      if (d.data) {
        setInitiateRecords([d.data, ...initiateRecords]);
        setShowInitiateModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddCustomItem = async () => {
    if (!customizeName.trim()) return;
    try {
      const res = await fetch('/api/enterprise/customize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customizeName, type: customizeType, description: customizeDesc }),
      });
      const d = await res.json();
      if (d.data) {
        setCustomItems([...customItems, d.data]);
        setShowCustomizeModal(false);
        setCustomizeName('');
        setCustomizeDesc('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCustomItem = async (id: number) => {
    try {
      await fetch(`/api/enterprise/customize?id=${id}`, { method: 'DELETE' });
      setCustomItems(customItems.filter(i => i.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-role-admin flex items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-role-admin border-t-transparent rounded-full animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  const progressStats = {
    not_started: players.filter(p => p.status === '未开始').length,
    in_progress: players.filter(p => p.status === '进行中').length,
    completed: players.filter(p => p.status === '已完成').length,
  };

  const customizeTypeLabels: Record<string, string> = {
    client: '客户',
    product: '产品',
    knowledge: '知识库',
    history: '公司历史',
  };

  const customizeTypeIcons: Record<string, typeof Building2> = {
    client: Building2,
    product: Package,
    knowledge: BookOpen,
    history: History,
  };

  return (
    <div className="min-h-screen bg-role-admin">
      {/* Header */}
      <header className="topbar-glass sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={() => router.push('/')} className="text-muted-foreground hover:text-foreground p-2 hover:bg-muted rounded-lg transition-colors" title="返回首页">
              <Shield className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{ background: '#0EA5E9' }}>
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">企业管理员工作台</div>
                <div className="text-[10px] text-muted-foreground">学员 · 进度 · 邀请码 · 报告</div>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-1 text-sm ml-8">
              <button onClick={() => router.push('/designer')} className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5" /> 游戏设计师
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm" style={{ background: '#0EA5E9' }}>企业管理员</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl border border-border px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.1)' }}>
              <Users className="w-4 h-4" style={{ color: '#0EA5E9' }} />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{players.length}</div>
              <div className="text-xs text-muted-foreground">玩家总数</div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Play className="w-4 h-4 text-success" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{progressStats.in_progress}</div>
              <div className="text-xs text-muted-foreground">进行中</div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.1)' }}>
              <Lock className="w-4 h-4" style={{ color: '#0EA5E9' }} />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{lockConfig.scenario_locked ? '已锁定' : '未锁定'}</div>
              <div className="text-xs text-muted-foreground">场景状态</div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{initiateRecords.length}</div>
              <div className="text-xs text-muted-foreground">发起次数</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-card rounded-t-2xl border border-border border-b-0 px-6 flex items-center gap-6 overflow-x-auto">
          {([
            ['players', '人员管理', Users],
            ['progress', '游戏进度', BarChart3],
            ['lock', '锁定配置', Lock],
            ['initiate', '发起对局', Play],
            ['customize', '定制内容', Settings],
            ['history', '历史记录', History],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`relative py-4 text-sm font-semibold flex items-center gap-2 whitespace-nowrap ${activeTab === key ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              <Icon className="w-4 h-4" /> {label}
              {activeTab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#0EA5E9' }} />}
            </button>
          ))}
        </div>

        <div className="bg-card rounded-b-2xl border border-border border-t-0 p-6">
          {/* 人员管理 */}
          {activeTab === 'players' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-foreground">企业玩家列表</div>
                <button onClick={handleAddPlayer} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1" style={{ background: '#0EA5E9' }}>
                  <Plus className="w-3.5 h-3.5" /> 添加玩家
                </button>
              </div>
              {players.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-container border-b border-border">
                        <th className="px-4 py-3 text-left font-semibold text-foreground">用户名</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">角色</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">状态</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">进度</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">加入时间</th>
                        <th className="px-4 py-3 text-right font-semibold text-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map(p => (
                        <tr key={p.id} className="border-b border-border hover:bg-surface-container/50">
                          <td className="px-4 py-3 font-semibold text-foreground">{p.username}</td>
                          <td className="px-4 py-3 text-foreground">{p.role}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.status === '在线' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                            }`}>{p.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.progress === '已完成' ? 'bg-success/10 text-success' :
                              p.progress === '进行中' ? 'bg-primary/10 text-primary' :
                              'bg-muted text-muted-foreground'
                            }`}>{p.progress}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(p.joined_at).toLocaleDateString('zh-CN')}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => handleEditPlayer(p)} className="text-primary hover:text-primary/80"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDeletePlayer(p.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">暂无玩家，点击「添加玩家」开始</div>
              )}
            </div>
          )}

          {/* 游戏进度 */}
          {activeTab === 'progress' && (
            <div>
              {/* Breadcrumb navigation */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <button onClick={() => { setProgressView('overview'); setSelectedClassId(null); setSelectedPersonId(null); }} className="hover:text-foreground">游戏进度</button>
                {progressView === 'classes' && <><span>/</span><span className="text-foreground">班次列表</span></>}
                {progressView === 'class-detail' && <><span>/</span><button onClick={() => setProgressView('classes')} className="hover:text-foreground">班次列表</button><span>/</span><span className="text-foreground">{classData.find(c => c.id === selectedClassId)?.name}</span></>}
                {progressView === 'person-detail' && <><span>/</span><button onClick={() => setProgressView('classes')} className="hover:text-foreground">班次列表</button><span>/</span><button onClick={() => setProgressView('class-detail')} className="hover:text-foreground">{classData.find(c => c.id === selectedClassId)?.name}</button><span>/</span><span className="text-foreground">{personDetails.find(p => p.id === selectedPersonId)?.name}</span></>}
                {progressView === 'all-people' && <><span>/</span><span className="text-foreground">全部人员</span></>}
              </div>

              {/* Overview */}
              {progressView === 'overview' && (
                <div>
                  <div className="text-sm font-semibold text-foreground mb-4">游戏完成进度</div>
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <button onClick={() => setProgressView('classes')} className="rounded-xl border border-border p-4 text-center hover:border-primary/30 hover:shadow-sm transition-all">
                      <Clock className="w-6 h-6 text-primary mx-auto mb-2" />
                      <div className="text-2xl font-bold text-foreground">{classData.filter(c => c.status === 'in_progress').length}个班</div>
                      <div className="text-xs text-muted-foreground">进行中</div>
                    </button>
                    <button onClick={() => setProgressView('classes')} className="rounded-xl border border-border p-4 text-center hover:border-success/30 hover:shadow-sm transition-all">
                      <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-2" />
                      <div className="text-2xl font-bold text-foreground">{classData.filter(c => c.status === 'completed').length}个班</div>
                      <div className="text-xs text-muted-foreground">已完成</div>
                    </button>
                    <button onClick={() => { setProgressView('all-people'); setPeopleFilter('all'); }} className="rounded-xl border border-border p-4 text-center hover:border-purple-500/30 hover:shadow-sm transition-all">
                      <Users className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-foreground">{classData.reduce((sum, c) => sum + c.totalPeople, 0)}人</div>
                      <div className="text-xs text-muted-foreground">总数</div>
                    </button>
                    <div className="rounded-xl border border-border p-4 text-center">
                      <BarChart3 className="w-6 h-6 mx-auto mb-2" style={{ color: '#0EA5E9' }} />
                      <div className="text-2xl font-bold text-foreground">{Math.round(classData.reduce((sum, c) => sum + c.completedPeople, 0) / classData.reduce((sum, c) => sum + c.totalPeople, 0) * 100)}%</div>
                      <div className="text-xs text-muted-foreground">完成率</div>
                    </div>
                  </div>

                  {/* Summary stats */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-center">
                      <div className="text-xl font-bold text-success">{classData.reduce((sum, c) => sum + c.completedPeople, 0)}人</div>
                      <div className="text-xs text-muted-foreground mt-1">全部完成（四关全过）</div>
                    </div>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                      <div className="text-xl font-bold text-primary">{classData.reduce((sum, c) => sum + c.partialPeople, 0)}人</div>
                      <div className="text-xs text-muted-foreground mt-1">部分完成（至少一关）</div>
                    </div>
                    <div className="rounded-xl border border-border p-4 text-center">
                      <div className="text-xl font-bold text-foreground">{classData.reduce((sum, c) => sum + c.loggedPeople, 0)}人</div>
                      <div className="text-xs text-muted-foreground mt-1">已登录</div>
                    </div>
                    <div className="rounded-xl border border-border p-4 text-center">
                      <div className="text-xl font-bold text-foreground">{classData.reduce((sum, c) => sum + c.totalPeople, 0)}人</div>
                      <div className="text-xs text-muted-foreground mt-1">总人数</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Classes list */}
              {progressView === 'classes' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-semibold text-foreground">班次列表</div>
                    <div className="flex gap-2">
                      <button onClick={() => setProgressView('classes')} className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-semibold">全部</button>
                    </div>
                  </div>
                  {/* In Progress Classes */}
                  <div className="mb-6">
                    <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-primary" /> 进行中（{classData.filter(c => c.status === 'in_progress').length}个班）</div>
                    <div className="space-y-2">
                      {classData.filter(c => c.status === 'in_progress').map(cls => (
                        <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setProgressView('class-detail'); }} className="w-full rounded-xl border border-border p-4 text-left hover:border-primary/30 hover:shadow-sm transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-foreground text-sm">{cls.name}</div>
                            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">进行中</span>
                          </div>
                          <div className="text-xs text-muted-foreground mb-3">{cls.note} | {cls.time}</div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-success font-semibold">完成 {cls.completedPeople}人</span>
                            <span className="text-primary font-semibold">登录 {cls.loggedPeople}人</span>
                            <span className="text-muted-foreground">总数 {cls.totalPeople}人</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Completed Classes */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> 已完成（{classData.filter(c => c.status === 'completed').length}个班）</div>
                    <div className="space-y-2">
                      {classData.filter(c => c.status === 'completed').map(cls => (
                        <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setProgressView('class-detail'); }} className="w-full rounded-xl border border-border p-4 text-left hover:border-success/30 hover:shadow-sm transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-foreground text-sm">{cls.name}</div>
                            <span className="px-2 py-0.5 rounded bg-success/10 text-success text-[10px] font-bold">已完成</span>
                          </div>
                          <div className="text-xs text-muted-foreground mb-3">{cls.note} | {cls.time}</div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-success font-semibold">完成 {cls.completedPeople}人</span>
                            <span className="text-muted-foreground">总数 {cls.totalPeople}人</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Class detail */}
              {progressView === 'class-detail' && selectedClassId && (() => {
                const cls = classData.find(c => c.id === selectedClassId);
                const classPeople = personDetails.filter(p => p.classId === selectedClassId);
                if (!cls) return null;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm font-semibold text-foreground">{cls.name}</div>
                      <button onClick={() => { setProgressView('all-people'); setPeopleFilter('all'); }} className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-500 text-xs font-semibold flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> 总数 {cls.totalPeople}人
                      </button>
                    </div>
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3 mb-6">
                      <button onClick={() => setPeopleFilter('completed')} className="rounded-xl border border-success/20 bg-success/5 p-3 text-center hover:shadow-sm">
                        <div className="text-lg font-bold text-success">{cls.completedPeople}人</div>
                        <div className="text-[10px] text-muted-foreground">全部完成</div>
                      </button>
                      <button onClick={() => setPeopleFilter('partial')} className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center hover:shadow-sm">
                        <div className="text-lg font-bold text-primary">{cls.partialPeople}人</div>
                        <div className="text-[10px] text-muted-foreground">部分完成</div>
                      </button>
                      <div className="rounded-xl border border-border p-3 text-center">
                        <div className="text-lg font-bold text-foreground">{cls.loggedPeople}人</div>
                        <div className="text-[10px] text-muted-foreground">已登录</div>
                      </div>
                      <div className="rounded-xl border border-border p-3 text-center">
                        <div className="text-lg font-bold text-foreground">{cls.totalPeople}人</div>
                        <div className="text-[10px] text-muted-foreground">总数</div>
                      </div>
                    </div>
                    {/* People list */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-surface-container border-b border-border">
                            <th className="px-4 py-3 text-left font-semibold text-foreground">姓名</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">角色</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">登录时间</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">完成关卡</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classPeople.map(p => (
                            <tr key={p.id} className="border-b border-border hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedPersonId(p.id); setProgressView('person-detail'); }}>
                              <td className="px-4 py-3 font-semibold text-foreground">{p.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{p.role}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{p.loginTime}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  {[0,1,2,3].map(i => (
                                    <div key={i} className={`w-5 h-1.5 rounded-full ${p.stages[i]?.completed ? 'bg-success' : 'bg-muted'}`} />
                                  ))}
                                  <span className="text-xs text-muted-foreground ml-1">{p.totalCompleted}/4</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  p.totalCompleted === 4 ? 'bg-success/10 text-success' :
                                  p.totalCompleted > 0 ? 'bg-primary/10 text-primary' :
                                  p.loginTime ? 'bg-muted text-muted-foreground' : 'bg-muted/50 text-muted-foreground/50'
                                }`}>
                                  {p.totalCompleted === 4 ? '已完成' : p.totalCompleted > 0 ? '进行中' : p.loginTime ? '已登录' : '未登录'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* Person detail */}
              {progressView === 'person-detail' && selectedPersonId && (() => {
                const person = personDetails.find(p => p.id === selectedPersonId);
                if (!person) return null;
                return (
                  <div>
                    <div className="text-sm font-semibold text-foreground mb-4">{person.name} - 个人详情</div>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="rounded-xl border border-border p-4">
                        <div className="text-xs text-muted-foreground mb-1">登录时间</div>
                        <div className="text-sm font-semibold text-foreground">{person.loginTime || '未登录'}</div>
                      </div>
                      <div className="rounded-xl border border-border p-4">
                        <div className="text-xs text-muted-foreground mb-1">开始时间</div>
                        <div className="text-sm font-semibold text-foreground">{person.startTime || '未开始'}</div>
                      </div>
                      <div className="rounded-xl border border-border p-4">
                        <div className="text-xs text-muted-foreground mb-1">完成关卡</div>
                        <div className="text-sm font-semibold text-foreground">{person.totalCompleted} / 4</div>
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground mb-3">各关卡详情</div>
                    <div className="space-y-3">
                      {person.stages.map((stage, i) => (
                        <div key={i} className="rounded-xl border border-border p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-foreground text-sm">{stage.name}</div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${stage.completed ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                              {stage.completed ? '已完成' : '未完成'}
                            </span>
                          </div>
                          <div className="flex items-center gap-6 text-xs text-muted-foreground">
                            {stage.time && <span>完成时间: {stage.time}</span>}
                            {stage.attempts !== undefined && stage.attempts > 0 && <span>尝试次数: {stage.attempts}次</span>}
                            {!stage.completed && <span>尚未完成此关卡</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Report button */}
                    {person.totalCompleted > 0 && (
                      <div className="mt-6 flex justify-end">
                        <button className="px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5" style={{ background: '#0EA5E9' }}>
                          <BarChart3 className="w-3.5 h-3.5" /> 查看结算报告
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* All people popup */}
              {progressView === 'all-people' && (() => {
                const allPeople = personDetails;
                const completedCount = allPeople.filter(p => p.totalCompleted === 4).length;
                const partialCount = allPeople.filter(p => p.totalCompleted > 0 && p.totalCompleted < 4).length;
                const loggedCount = allPeople.filter(p => p.loginTime).length;
                const totalCount = allPeople.length;

                const filteredPeople = peopleFilter === 'completed' ? allPeople.filter(p => p.totalCompleted === 4) :
                  peopleFilter === 'partial' ? allPeople.filter(p => p.totalCompleted > 0 && p.totalCompleted < 4) :
                  peopleFilter === 'logged' ? allPeople.filter(p => p.loginTime) :
                  allPeople;

                return (
                  <div>
                    <div className="text-sm font-semibold text-foreground mb-4">全部人员</div>
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3 mb-6">
                      <button onClick={() => setPeopleFilter('completed')} className={`rounded-xl border p-3 text-center transition-all ${peopleFilter === 'completed' ? 'border-success bg-success/10' : 'border-success/20 bg-success/5 hover:shadow-sm'}`}>
                        <div className="text-lg font-bold text-success">{completedCount}人</div>
                        <div className="text-[10px] text-muted-foreground">全部完成（四关全过）</div>
                      </button>
                      <button onClick={() => setPeopleFilter('partial')} className={`rounded-xl border p-3 text-center transition-all ${peopleFilter === 'partial' ? 'border-primary bg-primary/10' : 'border-primary/20 bg-primary/5 hover:shadow-sm'}`}>
                        <div className="text-lg font-bold text-primary">{partialCount}人</div>
                        <div className="text-[10px] text-muted-foreground">部分完成（至少一关）</div>
                      </button>
                      <button onClick={() => setPeopleFilter('logged')} className={`rounded-xl border p-3 text-center transition-all ${peopleFilter === 'logged' ? 'border-border bg-muted' : 'border-border hover:shadow-sm'}`}>
                        <div className="text-lg font-bold text-foreground">{loggedCount}人</div>
                        <div className="text-[10px] text-muted-foreground">已登录</div>
                      </button>
                      <button onClick={() => setPeopleFilter('all')} className={`rounded-xl border p-3 text-center transition-all ${peopleFilter === 'all' ? 'border-border bg-muted' : 'border-border hover:shadow-sm'}`}>
                        <div className="text-lg font-bold text-foreground">{totalCount}人</div>
                        <div className="text-[10px] text-muted-foreground">总人数</div>
                      </button>
                    </div>
                    {/* People table */}
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-surface-container border-b border-border">
                            <th className="px-4 py-3 text-left font-semibold text-foreground">姓名</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">角色</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">登录时间</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">开始时间</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">完成关卡</th>
                            <th className="px-4 py-3 text-left font-semibold text-foreground">次数(单机)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPeople.map(p => (
                            <tr key={p.id} className="border-b border-border hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedPersonId(p.id); setProgressView('person-detail'); }}>
                              <td className="px-4 py-3 font-semibold text-foreground">{p.name}</td>
                              <td className="px-4 py-3 text-muted-foreground">{p.role}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{p.loginTime || '-'}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{p.startTime || '-'}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  {[0,1,2,3].map(i => (
                                    <div key={i} className={`w-5 h-1.5 rounded-full ${p.stages[i]?.completed ? 'bg-success' : 'bg-muted'}`} />
                                  ))}
                                  <span className="text-xs text-muted-foreground ml-1">{p.totalCompleted}/4</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {p.stages.reduce((sum, s) => sum + (s.attempts || 0), 0)}次
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* 锁定配置 */}
          {activeTab === 'lock' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">场景锁定配置</div>
                  <div className="text-xs text-muted-foreground mt-0.5">锁定后，所有玩家将使用统一的甲乙方场景，无法自行选择</div>
                </div>
                {lockConfig.scenario_locked ? (
                  <button onClick={handleUnlock} className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-1 hover:bg-destructive/20">
                    <Unlock className="w-3.5 h-3.5" /> 解锁
                  </button>
                ) : (
                  <button onClick={handleSaveLock} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1" style={{ background: '#0EA5E9' }}>
                    <Lock className="w-3.5 h-3.5" /> 锁定场景
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border p-5">
                  <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Building2 className="w-4 h-4" style={{ color: '#0EA5E9' }} /> 甲方信息锁定
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5">客户单位</label>
                      <input
                        type="text"
                        value={lockConfig.client_unit}
                        onChange={e => setLockConfig({ ...lockConfig, client_unit: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="如：某市公安局"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5">所属行业</label>
                      <input
                        type="text"
                        value={lockConfig.client_industry}
                        onChange={e => setLockConfig({ ...lockConfig, client_industry: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="如：政府/医疗/教育"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-5">
                  <div className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-warning" /> 乙方产品锁定
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">指定产品</label>
                    <input
                      type="text"
                      value={lockConfig.vendor_product}
                      onChange={e => setLockConfig({ ...lockConfig, vendor_product: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="如：智慧政务云平台 V3.0"
                    />
                  </div>
                </div>

                {lockConfig.scenario_locked && (
                  <div className="rounded-xl border p-4 flex items-center gap-3" style={{ borderColor: 'rgba(14,165,233,0.3)', background: 'rgba(14,165,233,0.05)' }}>
                    <Lock className="w-5 h-5" style={{ color: '#0EA5E9' }} />
                    <div>
                      <div className="text-sm font-semibold text-foreground">场景已锁定</div>
                      <div className="text-xs text-muted-foreground">
                        甲方：{lockConfig.client_unit || '未设置'} | 行业：{lockConfig.client_industry || '未设置'} | 产品：{lockConfig.vendor_product || '未设置'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 教练邀请码 */}
              <div className="mt-6 rounded-xl border border-border p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <KeyRound className="w-4 h-4" style={{ color: '#EA580C' }} /> 培训教练邀请码
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">生成邀请码后，培训教练需输入邀请码才能进行操作</div>
                  </div>
                  <button
                    onClick={handleGenerateInviteCode}
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1 hover:opacity-90"
                    style={{ background: '#EA580C' }}
                  >
                    <Plus className="w-3.5 h-3.5" /> 生成邀请码
                  </button>
                </div>
                {inviteCode ? (
                  <div className="rounded-lg p-4 flex items-center justify-between" style={{ background: 'rgba(234,88,12,0.05)', border: '1px solid rgba(234,88,12,0.2)' }}>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">当前邀请码</div>
                      <div className="text-2xl font-bold font-mono tracking-widest" style={{ color: '#EA580C' }}>{inviteCode}</div>
                      <div className="text-xs text-muted-foreground mt-1">将此邀请码提供给培训教练使用</div>
                    </div>
                    <button
                      onClick={() => { navigator.clipboard.writeText(inviteCode); }}
                      className="p-2 rounded-lg bg-surface-container hover:bg-surface-container/80"
                      title="复制邀请码"
                    >
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    尚未生成邀请码，培训教练当前无法操作
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 发起对局 */}
          {activeTab === 'initiate' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-foreground">发起对局记录</div>
                <button onClick={() => setShowInitiateModal(true)} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1" style={{ background: '#0EA5E9' }}>
                  <Play className="w-3.5 h-3.5" /> 发起新对局
                </button>
              </div>
              {initiateRecords.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-container border-b border-border">
                        <th className="px-4 py-3 text-left font-semibold text-foreground">房间号</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">委托教练</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">教练查报告</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">参与人数</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">状态</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">发起时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {initiateRecords.map(r => (
                        <tr key={r.id} className="border-b border-border hover:bg-surface-container/50">
                          <td className="px-4 py-3 font-mono font-semibold text-foreground">{r.room_code}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.delegate_to_coach ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>{r.delegate_to_coach ? '联机版' : '单机版'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.allow_coach_view ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                            }`}>{r.allow_coach_view ? '是' : '否'}</span>
                          </td>
                          <td className="px-4 py-3 text-foreground">{r.player_count}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.status === '进行中' ? 'bg-success/10 text-success' :
                              r.status === '已结束' ? 'bg-muted text-muted-foreground' :
                              'bg-primary/10 text-primary'
                            }`}>{r.status}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString('zh-CN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">暂无发起记录</div>
              )}
            </div>
          )}

          {/* 定制内容 */}
          {activeTab === 'customize' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-foreground">定制内容管理</div>
                <button onClick={() => { setCustomizeName(''); setCustomizeDesc(''); setShowCustomizeModal(true); }} className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1" style={{ background: '#0EA5E9' }}>
                  <Plus className="w-3.5 h-3.5" /> 新增内容
                </button>
              </div>

              {/* Filter by type */}
              <div className="flex items-center gap-2 mb-4">
                {(['all', 'client', 'product', 'knowledge', 'history'] as const).map(type => (
                  <button
                    key={type}
                    className="px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                  >
                    {type === 'all' ? '全部' : customizeTypeLabels[type]}
                  </button>
                ))}
              </div>

              {customItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {customItems.map(item => {
                    const IconComp = customizeTypeIcons[item.type] || Package;
                    return (
                      <div key={item.id} className="rounded-xl border border-border p-4 flex items-start gap-3 hover:border-primary/30 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0">
                          <IconComp className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground truncate">{item.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-container text-muted-foreground">{customizeTypeLabels[item.type]}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</div>
                        </div>
                        <button onClick={() => handleDeleteCustomItem(item.id)} className="text-destructive hover:text-destructive/80 flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">暂无定制内容</div>
              )}
            </div>
          )}

          {/* 历史记录 */}
          {activeTab === 'history' && (
            <div>
              <div className="text-sm font-semibold text-foreground mb-4">发起历史与学员报告</div>
              {studentReports.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-container border-b border-border">
                        <th className="px-4 py-3 text-left font-semibold text-foreground">学员</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">房间</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">得分</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">轮次</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">结果</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">完成时间</th>
                        <th className="px-4 py-3 text-right font-semibold text-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentReports.map(r => (
                        <tr key={r.id} className="border-b border-border hover:bg-surface-container/50">
                          <td className="px-4 py-3 font-semibold text-foreground">{r.player_name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-foreground">{r.room_code}</td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-foreground">{r.score}</span>
                            <span className="text-xs text-muted-foreground ml-1">分</span>
                          </td>
                          <td className="px-4 py-3 text-foreground">{r.rounds} 轮</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.result === 'win' ? 'bg-success/10 text-success' :
                              r.result === 'lose' ? 'bg-destructive/10 text-destructive' :
                              'bg-muted text-muted-foreground'
                            }`}>{r.result === 'win' ? '攻略成功' : r.result === 'lose' ? '攻略失败' : '进行中'}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(r.completed_at).toLocaleString('zh-CN')}</td>
                          <td className="px-4 py-3 text-right">
                            <button className="text-primary hover:text-primary/80">
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">暂无学员报告</div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Player Modal */}
      {showPlayerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPlayerModal(false)}>
          <div className="bg-card rounded-2xl p-6 w-[400px] border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-semibold text-foreground">{editingPlayer ? '编辑玩家' : '添加玩家'}</div>
              <button onClick={() => setShowPlayerModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">用户名</label>
                <input
                  type="text"
                  value={playerForm.username}
                  onChange={e => setPlayerForm({ ...playerForm, username: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="输入用户名"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">角色</label>
                <select
                  value={playerForm.role}
                  onChange={e => setPlayerForm({ ...playerForm, role: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="player">玩家</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setShowPlayerModal(false)} className="px-4 py-2 rounded-lg bg-surface-container text-xs font-semibold text-foreground">取消</button>
              <button onClick={handleSavePlayer} className="px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1" style={{ background: '#0EA5E9' }}>
                <Save className="w-3.5 h-3.5" /> 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Initiate Modal */}
      {showInitiateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowInitiateModal(false)}>
          <div className="bg-card rounded-2xl p-6 w-[440px] border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-semibold text-foreground">发起新对局</div>
              <button onClick={() => setShowInitiateModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-surface-container/50 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">委托给培训教练</div>
                    <div className="text-xs text-muted-foreground mt-1">开启后由培训教练控制游戏，为联机版</div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !initiateDelegate;
                      setInitiateDelegate(next);
                      if (next) setInitiateCoachVisible(true);
                    }}
                    className={`w-12 h-6 rounded-full transition-colors ${initiateDelegate ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${initiateDelegate ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
              <div className={`p-4 rounded-lg border ${initiateDelegate ? 'bg-surface-container/50 border-border' : 'bg-surface-container/30 border-border/50 opacity-50'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">允许教练查看报告</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {initiateDelegate ? '开启后培训教练可查看学员报告' : '需先开启「委托给培训教练」'}
                    </div>
                  </div>
                  <button
                    onClick={() => initiateDelegate && setInitiateCoachVisible(!initiateCoachVisible)}
                    disabled={!initiateDelegate}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      !initiateDelegate ? 'bg-muted cursor-not-allowed' : initiateCoachVisible ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      !initiateDelegate ? 'translate-x-0.5' : initiateCoachVisible ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setShowInitiateModal(false)} className="px-4 py-2 rounded-lg bg-surface-container text-xs font-semibold text-foreground">取消</button>
              <button onClick={handleInitiate} className="px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1" style={{ background: '#0EA5E9' }}>
                <Play className="w-3.5 h-3.5" /> 发起
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customize Modal */}
      {showCustomizeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCustomizeModal(false)}>
          <div className="bg-card rounded-2xl p-6 w-[440px] border border-border" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-base font-semibold text-foreground">新增定制内容</div>
              <button onClick={() => setShowCustomizeModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">内容类型</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['client', 'product', 'knowledge', 'history'] as const).map(type => {
                    const IconComp = customizeTypeIcons[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setCustomizeType(type)}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          customizeType === type ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <IconComp className={`w-4 h-4 mx-auto mb-1 ${customizeType === type ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="text-[10px] font-medium text-foreground">{customizeTypeLabels[type]}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">名称</label>
                <input
                  type="text"
                  value={customizeName}
                  onChange={e => setCustomizeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="输入名称"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">描述</label>
                <textarea
                  value={customizeDesc}
                  onChange={e => setCustomizeDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  placeholder="输入描述信息"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setShowCustomizeModal(false)} className="px-4 py-2 rounded-lg bg-surface-container text-xs font-semibold text-foreground">取消</button>
              <button onClick={handleAddCustomItem} className="px-4 py-2 rounded-lg text-white text-xs font-semibold flex items-center gap-1" style={{ background: '#0EA5E9' }}>
                <Save className="w-3.5 h-3.5" /> 保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
