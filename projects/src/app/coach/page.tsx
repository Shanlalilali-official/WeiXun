'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Megaphone, Plus, Copy, Play, StopCircle, Users, BarChart3, FileText, ArrowLeft, Wand2, Building2, Eye, MessageSquare, List, Lock, Unlock, History, ChevronDown, ChevronRight, Trophy, KeyRound } from 'lucide-react';

interface Room {
  id: number;
  room_code: string;
  max_players: number;
  current_players: number;
  status: string;
  game_mode: string;
  created_at: string;
  initiated_by?: string;
  allow_coach_view?: boolean;
}

interface Group {
  id: number;
  room_id: number;
  group_name: string;
  players: string[];
  selected_company: string;
  status: string;
}

interface PlayerData {
  id: number;
  username: string;
  room_code: string;
  group_name: string;
  status: string;
  score: number;
}

interface LockConfig {
  client_unit: string;
  vendor_product: string;
  scenario: string;
  is_locked: boolean;
}

interface HistoryItem {
  id: number;
  room_code: string;
  initiated_at: string;
  game_mode: string;
  player_count: number;
  status: string;
  can_view_reports: boolean;
}

export default function CoachPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rooms' | 'groups' | 'reports' | 'ranking' | 'lock' | 'history'>('rooms');
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [gameMode, setGameMode] = useState<'overview' | 'dialogue' | 'free'>('overview');

  // 邀请码
  const [inviteCode, setInviteCode] = useState('');
  const [inviteCodeVerified, setInviteCodeVerified] = useState(false);
  const [inviteCodeError, setInviteCodeError] = useState('');
  
  // 锁定配置
  const [lockConfig, setLockConfig] = useState<LockConfig>({
    client_unit: '',
    vendor_product: '',
    scenario: '',
    is_locked: false
  });
  
  // 发起配置
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [initiateConfig, setInitiateConfig] = useState({
    game_mode: 'overview' as 'overview' | 'dialogue' | 'free'
  });
  
  // 历史记录
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<number | null>(null);

  useEffect(() => {
    // 加载房间数据
    fetch('/api/coach/rooms')
      .then(r => r.json())
      .then(d => setRooms(d.data || []))
      .catch(() => {});

    // 加载小组数据
    fetch('/api/coach/groups')
      .then(r => r.json())
      .then(d => setGroups(d.data || []))
      .catch(() => {});

    // 加载玩家数据
    fetch('/api/coach/players')
      .then(r => r.json())
      .then(d => setPlayers(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    
    // 加载锁定配置
    fetch('/api/coach/lock')
      .then(r => r.json())
      .then(d => {
        if (d.data) setLockConfig(d.data);
      })
      .catch(() => {});
    
    // 加载历史记录
    fetch('/api/coach/history')
      .then(r => r.json())
      .then(d => setHistory(d.data || []))
      .catch(() => {});
  }, []);

  const handleCreateRoom = async () => {
    try {
      const res = await fetch('/api/coach/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          max_groups: 33, 
          players_per_group: 3,
          initiated_by: 'coach',
          allow_coach_view: true
        }),
      });
      const d = await res.json();
      if (d.data) {
        setRooms([...rooms, d.data]);
        setShowCreateRoom(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartGame = async (roomId: number) => {
    try {
      await fetch(`/api/coach/rooms/${roomId}/start`, { method: 'POST' });
      setRooms(rooms.map(r => r.id === roomId ? { ...r, status: '进行中' } : r));
    } catch (e) {
      console.error(e);
    }
  };

  const handleEndGame = async (roomId: number) => {
    if (!confirm('确定结束该房间的对局？')) return;
    try {
      await fetch(`/api/coach/rooms/${roomId}/end`, { method: 'POST' });
      setRooms(rooms.map(r => r.id === roomId ? { ...r, status: '已结束' } : r));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('邀请码已复制');
  };

  const handleUpdateGroupCompany = async (groupId: number, company: string) => {
    try {
      await fetch(`/api/coach/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_company: company }),
      });
      setGroups(groups.map(g => g.id === groupId ? { ...g, selected_company: company } : g));
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateGameMode = async (roomId: number, mode: string) => {
    try {
      await fetch(`/api/coach/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_mode: mode }),
      });
      setRooms(rooms.map(r => r.id === roomId ? { ...r, game_mode: mode } : r));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveLock = async () => {
    try {
      await fetch('/api/coach/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lockConfig),
      });
      setLockConfig({ ...lockConfig, is_locked: true });
      alert('锁定配置已保存');
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnlock = async () => {
    try {
      await fetch('/api/coach/lock', {
        method: 'DELETE',
      });
      setLockConfig({ client_unit: '', vendor_product: '', scenario: '', is_locked: false });
      alert('已解除锁定');
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyInviteCode = () => {
    if (!inviteCode.trim()) {
      setInviteCodeError('请输入邀请码');
      return;
    }
    // 当前阶段：任意邀请码均可通过验证
    setInviteCodeVerified(true);
    setInviteCodeError('');
  };

  const handleInitiateGame = async () => {
    try {
      const res = await fetch('/api/coach/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initiateConfig),
      });
      const d = await res.json();
      if (d.data) {
        setRooms([...rooms, d.data]);
        setShowInitiateModal(false);
        alert('对局已发起');
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#F6F8FB' }}>
      {/* 顶部导航 */}
      <header className="h-16 bg-card border-b border-border px-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => router.push('/')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-warning flex items-center justify-center">
              <Megaphone className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-foreground">培训教练工作台</span>
          </div>
          <nav className="flex items-center gap-1 text-sm ml-8">
            <button onClick={() => router.push('/designer')} className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5" /> 游戏设计师
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card rounded-xl border border-border px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{rooms.length}</div>
              <div className="text-xs text-muted-foreground">房间总数</div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Play className="w-4 h-4 text-success" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{rooms.filter(r => r.status === '进行中').length}</div>
              <div className="text-xs text-muted-foreground">进行中</div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <List className="w-4 h-4 text-warning" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{groups.length}</div>
              <div className="text-xs text-muted-foreground">小组总数</div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{players.length}</div>
              <div className="text-xs text-muted-foreground">玩家总数</div>
            </div>
          </div>
        </div>

        {/* 邀请码验证 */}
        {!inviteCodeVerified && (
          <div className="bg-card rounded-2xl border border-border p-8">
            <div className="max-w-md mx-auto text-center">
              <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(234,88,12,0.1)' }}>
                <KeyRound className="w-6 h-6" style={{ color: '#EA580C' }} />
              </div>
              <div className="text-lg font-bold text-foreground mb-1">请输入邀请码</div>
              <div className="text-sm text-muted-foreground mb-5">企业管理员已锁定教练权限，请输入邀请码后继续操作</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => { setInviteCode(e.target.value); setInviteCodeError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyInviteCode()}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 text-center tracking-widest font-mono"
                  placeholder="请输入邀请码"
                />
                <button
                  onClick={handleVerifyInviteCode}
                  className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90"
                  style={{ background: '#EA580C' }}
                >
                  验证
                </button>
              </div>
              {inviteCodeError && (
                <div className="text-xs mt-2" style={{ color: '#EA580C' }}>{inviteCodeError}</div>
              )}
            </div>
          </div>
        )}

        {/* Tab 切换 */}
        {inviteCodeVerified && (
        <>
        <div className="bg-card rounded-t-2xl border border-border border-b-0 px-6 flex items-center gap-8">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`relative py-4 text-sm font-semibold flex items-center gap-2 ${activeTab === 'rooms' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <Users className="w-4 h-4" /> 房间管理
            {activeTab === 'rooms' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-warning" />}
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`relative py-4 text-sm font-semibold flex items-center gap-2 ${activeTab === 'groups' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <List className="w-4 h-4" /> 小组管理
            {activeTab === 'groups' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-warning" />}
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`relative py-4 text-sm font-semibold flex items-center gap-2 ${activeTab === 'reports' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <FileText className="w-4 h-4" /> 结算报告
            {activeTab === 'reports' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-warning" />}
          </button>
          <button
            onClick={() => setActiveTab('ranking')}
            className={`relative py-4 text-sm font-semibold flex items-center gap-2 ${activeTab === 'ranking' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <Trophy className="w-4 h-4" /> 玩家排行榜
            {activeTab === 'ranking' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-warning" />}
          </button>
          <button
            onClick={() => setActiveTab('lock')}
            className={`relative py-4 text-sm font-semibold flex items-center gap-2 ${activeTab === 'lock' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <Lock className="w-4 h-4" /> 锁定配置
            {activeTab === 'lock' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-warning" />}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`relative py-4 text-sm font-semibold flex items-center gap-2 ${activeTab === 'history' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            <History className="w-4 h-4" /> 历史记录
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-warning" />}
          </button>
        </div>

        <div className="bg-card rounded-b-2xl border border-border border-t-0 p-6">
          {/* 房间管理 */}
          {activeTab === 'rooms' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-foreground">房间列表</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowInitiateModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold flex items-center gap-1 hover:bg-primary/90"
                  >
                    <Play className="w-3.5 h-3.5" /> 发起对局
                  </button>
                  <button
                    onClick={() => setShowCreateRoom(true)}
                    className="px-3 py-1.5 rounded-lg bg-warning text-white text-xs font-semibold flex items-center gap-1 hover:bg-warning/90"
                  >
                    <Plus className="w-3.5 h-3.5" /> 创建房间
                  </button>
                </div>
              </div>
              {rooms.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-container border-b border-border">
                        <th className="px-4 py-3 text-left font-semibold text-foreground">房间号</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">状态</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">游戏模式</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">玩家数</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">创建时间</th>
                        <th className="px-4 py-3 text-right font-semibold text-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.map((room) => (
                        <tr key={room.id} className="border-b border-border hover:bg-surface-container/50">
                          <td className="px-4 py-3 font-mono font-semibold text-foreground">{room.room_code}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              room.status === '未开始' ? 'bg-muted text-muted-foreground' :
                              room.status === '进行中' ? 'bg-success/10 text-success' :
                              'bg-destructive/10 text-destructive'
                            }`}>
                              {room.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={room.game_mode}
                              onChange={(e) => handleUpdateGameMode(room.id, e.target.value)}
                              className="px-2 py-1 rounded bg-surface-container border-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-warning/30"
                            >
                              <option value="overview">概述模式</option>
                              <option value="dialogue">对话模式</option>
                              <option value="free">自由模式</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-foreground">{room.current_players}/{room.max_players}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(room.created_at).toLocaleDateString('zh-CN')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleCopyCode(room.room_code)}
                                className="text-primary hover:text-primary/80"
                                title="复制邀请码"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              {room.status === '未开始' && (
                                <button
                                  onClick={() => handleStartGame(room.id)}
                                  className="text-success hover:text-success/80"
                                  title="开始对局"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                              )}
                              {room.status === '进行中' && (
                                <button
                                  onClick={() => handleEndGame(room.id)}
                                  className="text-destructive hover:text-destructive/80"
                                  title="结束对局"
                                >
                                  <StopCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  暂无房间，点击"创建房间"或"发起对局"开始
                </div>
              )}
            </div>
          )}

          {/* 小组管理 */}
          {activeTab === 'groups' && (
            <div>
              <div className="text-sm font-semibold text-foreground mb-4">小组列表</div>
              {groups.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-container border-b border-border">
                        <th className="px-4 py-3 text-left font-semibold text-foreground">小组名称</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">成员</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">选择公司</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group) => (
                        <tr key={group.id} className="border-b border-border hover:bg-surface-container/50">
                          <td className="px-4 py-3 font-semibold text-foreground">{group.group_name}</td>
                          <td className="px-4 py-3 text-foreground">{group.players.join(', ')}</td>
                          <td className="px-4 py-3">
                            <select
                              value={group.selected_company}
                              onChange={(e) => handleUpdateGroupCompany(group.id, e.target.value)}
                              className="px-2 py-1 rounded bg-surface-container border-none text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-warning/30"
                            >
                              <option value="">未选择</option>
                              <option value="A">A 公司</option>
                              <option value="B">B 公司</option>
                              <option value="C">C 公司</option>
                              <option value="D">D 公司</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              group.status === '未开始' ? 'bg-muted text-muted-foreground' :
                              group.status === '进行中' ? 'bg-success/10 text-success' :
                              'bg-primary/10 text-primary'
                            }`}>
                              {group.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  暂无小组数据
                </div>
              )}
            </div>
          )}

          {/* 结算报告 */}
          {activeTab === 'reports' && (
            <div>
              <div className="text-sm font-semibold text-foreground mb-4">玩家结算报告</div>
              {players.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-container border-b border-border">
                        <th className="px-4 py-3 text-left font-semibold text-foreground">玩家</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">房间</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">小组</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">状态</th>
                        <th className="px-4 py-3 text-left font-semibold text-foreground">得分</th>
                        <th className="px-4 py-3 text-right font-semibold text-foreground">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((player) => (
                        <tr key={player.id} className="border-b border-border hover:bg-surface-container/50">
                          <td className="px-4 py-3 font-semibold text-foreground">{player.username}</td>
                          <td className="px-4 py-3 font-mono text-xs text-foreground">{player.room_code}</td>
                          <td className="px-4 py-3 text-foreground">{player.group_name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              player.status === '未开始' ? 'bg-muted text-muted-foreground' :
                              player.status === '进行中' ? 'bg-success/10 text-success' :
                              'bg-primary/10 text-primary'
                            }`}>
                              {player.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">{player.score}</td>
                          <td className="px-4 py-3 text-right">
                            <button className="text-primary hover:text-primary/80" title="查看详细报告">
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  暂无玩家数据
                </div>
              )}
            </div>
          )}

          {/* 玩家排行榜 */}
          {activeTab === 'ranking' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-foreground">玩家排行榜</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">排序：</span>
                  <select className="px-2 py-1 rounded-lg bg-surface-container border-none text-xs text-foreground focus:outline-none">
                    <option value="score">综合得分</option>
                    <option value="affinity">亲密度</option>
                    <option value="strategy">策略分</option>
                    <option value="expression">表达分</option>
                  </select>
                </div>
              </div>
              {players.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-container/50 border-b border-border">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground w-16">排名</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">玩家</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">综合得分</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">亲密度</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">策略分</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">表达分</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">对局数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((player, index) => {
                        const score = (85 + ((player.id * 7 + 3) % 15)).toFixed(1);
                        const affinity = (70 + ((player.id * 11 + 5) % 30)).toFixed(1);
                        const strategy = (60 + ((player.id * 13 + 7) % 40)).toFixed(1);
                        const expression = (65 + ((player.id * 9 + 11) % 35)).toFixed(1);
                        const games = 3 + ((player.id * 5 + 2) % 8);
                        return (
                        <tr key={player.id} className={`border-b border-border last:border-b-0 ${index < 3 ? 'bg-warning/5' : ''}`}>
                          <td className="px-4 py-3">
                            {index === 0 && <span className="text-lg font-bold" style={{ color: '#FFD700' }}>🥇</span>}
                            {index === 1 && <span className="text-lg font-bold" style={{ color: '#C0C0C0' }}>🥈</span>}
                            {index === 2 && <span className="text-lg font-bold" style={{ color: '#CD7F32' }}>🥉</span>}
                            {index >= 3 && <span className="text-sm font-semibold text-muted-foreground">{index + 1}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: '#EA580C' }}>
                                {player.username.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-foreground">{player.username}</div>
                                <div className="text-xs text-muted-foreground">{player.group_name || '未分组'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-bold text-foreground">{score}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-semibold text-success">{affinity}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-semibold text-foreground">{strategy}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-semibold text-foreground">{expression}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-semibold text-foreground">{games}</span>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">暂无玩家数据</div>
              )}
            </div>
          )}

          {/* 锁定配置 */}
          {activeTab === 'lock' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-foreground">锁定甲乙方业务/场景</div>
                {lockConfig.is_locked && (
                  <span className="px-2 py-1 rounded bg-success/10 text-success text-xs font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> 已锁定
                  </span>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2">甲方单位</label>
                  <input
                    type="text"
                    value={lockConfig.client_unit}
                    onChange={(e) => setLockConfig({ ...lockConfig, client_unit: e.target.value })}
                    placeholder="例如：某市政务服务中心"
                    className="w-full px-4 py-2.5 rounded-lg bg-surface-container border-none text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-warning/30"
                    disabled={lockConfig.is_locked}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2">乙方产品</label>
                  <input
                    type="text"
                    value={lockConfig.vendor_product}
                    onChange={(e) => setLockConfig({ ...lockConfig, vendor_product: e.target.value })}
                    placeholder="例如：智慧政务一体化平台"
                    className="w-full px-4 py-2.5 rounded-lg bg-surface-container border-none text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-warning/30"
                    disabled={lockConfig.is_locked}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2">场景描述</label>
                  <textarea
                    value={lockConfig.scenario}
                    onChange={(e) => setLockConfig({ ...lockConfig, scenario: e.target.value })}
                    placeholder="描述具体的业务场景..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg bg-surface-container border-none text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-warning/30 resize-none"
                    disabled={lockConfig.is_locked}
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  {lockConfig.is_locked ? (
                    <button
                      onClick={handleUnlock}
                      className="px-4 py-2 rounded-lg bg-destructive text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-destructive/90"
                    >
                      <Unlock className="w-4 h-4" /> 解除锁定
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveLock}
                      className="px-4 py-2 rounded-lg bg-warning text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-warning/90"
                    >
                      <Lock className="w-4 h-4" /> 保存并锁定
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 历史记录 */}
          {activeTab === 'history' && (
            <div>
              <div className="text-sm font-semibold text-foreground mb-4">操作历史</div>
              {history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border overflow-hidden">
                      <div 
                        className="px-4 py-3 bg-surface-container/50 flex items-center justify-between cursor-pointer hover:bg-surface-container"
                        onClick={() => setExpandedHistory(expandedHistory === item.id ? null : item.id)}
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm font-semibold text-foreground">{item.room_code}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === '未开始' ? 'bg-muted text-muted-foreground' :
                            item.status === '进行中' ? 'bg-success/10 text-success' :
                            'bg-primary/10 text-primary'
                          }`}>
                            {item.status}
                          </span>
                          <span className="text-xs text-muted-foreground">{item.game_mode === 'overview' ? '概述模式' : item.game_mode === 'dialogue' ? '对话模式' : '自由模式'}</span>
                          <span className="text-xs text-muted-foreground">{item.player_count} 名玩家</span>
                          <span className="text-xs text-muted-foreground">{new Date(item.initiated_at).toLocaleDateString('zh-CN')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.can_view_reports && (
                            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">可查看报告</span>
                          )}
                          {expandedHistory === item.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </div>
                      {expandedHistory === item.id && item.can_view_reports && (
                        <div className="px-4 py-3 border-t border-border">
                          <div className="text-xs font-semibold text-foreground mb-2">玩家报告列表</div>
                          <div className="text-xs text-muted-foreground">
                            点击"结算报告"标签页查看该房间的详细报告
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  暂无历史记录
                </div>
              )}
            </div>
          )}
        </div>
        </>
        )}
      </main>

      {/* 创建房间弹窗 */}
      {showCreateRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCreateRoom(false)}>
          <div className="bg-card rounded-2xl p-6 w-[400px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-bold text-foreground mb-4">创建房间</div>
            <div className="space-y-3 mb-4">
              <div className="p-3 rounded-lg bg-surface-container/50 border border-border">
                <div className="text-xs text-muted-foreground mb-1">最大小组数</div>
                <div className="text-lg font-bold text-foreground">33 个小组</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-container/50 border border-border">
                <div className="text-xs text-muted-foreground mb-1">每组人数</div>
                <div className="text-lg font-bold text-foreground">3 人/组</div>
              </div>
              <div className="p-3 rounded-lg bg-surface-container/50 border border-border">
                <div className="text-xs text-muted-foreground mb-1">总容纳人数</div>
                <div className="text-lg font-bold text-foreground">99 人</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowCreateRoom(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-surface-container"
              >
                取消
              </button>
              <button
                onClick={handleCreateRoom}
                className="px-4 py-2 rounded-lg bg-warning text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-warning/90"
              >
                <Plus className="w-4 h-4" /> 确认创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 发起对局弹窗 */}
      {showInitiateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowInitiateModal(false)}>
          <div className="bg-card rounded-2xl p-6 w-[450px] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-bold text-foreground mb-4">发起对局</div>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-2">游戏模式</label>
                <select
                  value={initiateConfig.game_mode}
                  onChange={(e) => setInitiateConfig({ ...initiateConfig, game_mode: e.target.value as 'overview' | 'dialogue' | 'free' })}
                  className="w-full px-4 py-2.5 rounded-lg bg-surface-container border-none text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="overview">概述模式</option>
                  <option value="dialogue">对话模式</option>
                  <option value="free">自由模式（玩家自选）</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowInitiateModal(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-surface-container"
              >
                取消
              </button>
              <button
                onClick={handleInitiateGame}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-primary/90"
              >
                <Play className="w-4 h-4" /> 确认发起
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
