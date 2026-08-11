'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Star, Settings, ChevronDown, X, Copy, Sparkles, Coins } from 'lucide-react';

interface Hotspot {
  id: string;
  projectId?: number;
  name: string;
  budget: number;
  difficulty: number;
  difficultyLabel: string;
  left: string;
  top: string;
  type: 'main' | 'side' | 'fold';
  leader: { name: string; style: string; title: string };
  technicalDifficulties: string[];
  customerNeeds: string[];
  aiAdvice: string;
  expectedProfit: number;
  winRate: number;
}

// 四档项目（从数据库加载）
const DEFAULT_PROJECTS: Hotspot[] = [
  {
    id: 'project-1',
    projectId: 1,
    name: '单单位内部竞标',
    budget: 100,
    difficulty: 1,
    difficultyLabel: '新手入门',
    left: '20%', top: '40%',
    type: 'side',
    leader: { name: '赵峰', style: '老虎型，年富力强', title: '分管业务副主任' },
    technicalDifficulties: ['人物关系链短', '信息挖掘门槛低', '适合零基础销售'],
    customerNeeds: ['办公配套升级', '预算固定', '日常使用需求清晰'],
    aiAdvice: '单位内部人员层级简单，新任分管领导刚接手业务。当前决策链尚不明确，应先从基层和采购验证流程，再识别真正拍板人。',
    expectedProfit: 25,
    winRate: 70,
  },
  {
    id: 'project-2',
    projectId: 2,
    name: '国产化改造项目',
    budget: 300,
    difficulty: 2,
    difficultyLabel: '进阶实训',
    left: '40%', top: '30%',
    type: 'side',
    leader: { name: '陈主任', style: '老虎型（极度自负）', title: '设计院技术室主任' },
    technicalDifficulties: ['双主体并行攻关', '设计院话语权极高', '技术评审一票否决'],
    customerNeeds: ['国产化替代', '技术改造升级', '设计院技术认可'],
    aiAdvice: '设计院中基层技术室主任是核心卡点，手握技术一票否决权。需结合技术诉求+私人软肋双重公关。',
    expectedProfit: 28,
    winRate: 50,
  },
  {
    id: 'project-3',
    projectId: 3,
    name: '大型央企升级项目',
    budget: 1000,
    difficulty: 3,
    difficultyLabel: '高阶实训',
    left: '60%', top: '45%',
    type: 'side',
    leader: { name: '周副总工', style: '老虎型（极度自负）', title: '技术副总工' },
    technicalDifficulties: ['多部门制衡', '双主线分支', '线索链路最长', '容错率极低'],
    customerNeeds: ['千万级设备升级', '多平级部门协调', '中间人搭桥引荐'],
    aiAdvice: '技术副总工和设备分管副总掌握最终决定权，必须通过总经理亲属或服务商X总搭桥。两条主线自由选择。',
    expectedProfit: 35,
    winRate: 30,
  },
  {
    id: 'project-4',
    projectId: 4,
    name: '一体化总包解决方案',
    budget: 200,
    difficulty: 4,
    difficultyLabel: '专家挑战',
    left: '80%', top: '35%',
    type: 'side',
    leader: { name: '钱副局长', style: '老虎型', title: '分管高层领导' },
    technicalDifficulties: ['需求挖掘', '价值营销', '方案重塑', '策略门槛极高'],
    customerNeeds: ['标准化物资采购', '竞品低价碾压', '挖掘隐性痛点'],
    aiAdvice: '单品报价完全劣势，唯一破局路径是打通各层级，挖掘隐性痛点，将单一采购升级为一体化总包方案。',
    expectedProfit: 30,
    winRate: 35,
  },
];

export default function StartPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [showBackground, setShowBackground] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [identity, setIdentity] = useState<{ displayName: string; role: string } | null>(null);
  const [competitors, setCompetitors] = useState<{company_name: string; features: string; more_info: string; project_id: number}[]>([]);

  // 读取身份（顶栏显示个人名）
  useEffect(() => {
    let raw = localStorage.getItem('weixun_identity');
    if (!raw) {
      const match = document.cookie.match(/(?:^| )weixun_identity=([^;]+)/);
      if (match) raw = decodeURIComponent(match[1]);
    }
    if (raw) {
      try {
        const data = JSON.parse(raw);
        setIdentity({ displayName: data.displayName, role: data.role });
      } catch {}
    }
  }, []);

  // 派生：等级 / 职称（根据 role）
  const roleMeta: Record<string, { title: string; level: number; avatarChar: string }> = {
    platform_designer: { title: '平台设计师', level: 10, avatarChar: '设' },
    enterprise_admin: { title: '企业管理员', level: 8,  avatarChar: '管' },
    trainer:           { title: '培训教练',   level: 6,  avatarChar: '教' },
    player:            { title: '销售经理',   level: 4,  avatarChar: '销' },
  };
  const meta = identity ? roleMeta[identity.role] || roleMeta.player : { title: '销售经理', level: 4, avatarChar: '销' };
  const lastChar = identity?.displayName ? identity.displayName.slice(-1) : '?';

  const [projects, setProjects] = useState<Hotspot[]>(DEFAULT_PROJECTS);
  
  // 加载项目数据
  useEffect(() => {
    fetch('/api/game-data/projects')
      .then(r => r.json())
      .then(d => {
        if (d.data && d.data.length > 0) {
          // 用数据库数据更新项目名称和描述
          setProjects(prev => prev.map(p => {
            const dbProject = d.data.find((dp: { project_id: number }) => dp.project_id === p.projectId);
            if (dbProject) {
              return { ...p, name: dbProject.name, aiAdvice: dbProject.description };
            }
            return p;
          }));
        }
      })
      .catch(() => {});
  }, []);

  // 加载竞品数据
  useEffect(() => {
    fetch('/api/game-data/competitors')
      .then(r => r.json())
      .then(d => setCompetitors(d.data || []))
      .catch(() => {});
  }, []);

  const sideHotspots = projects;

  const handleStart = () => {
    if (!selected) return;
    if (selected.id !== 'project-1') return;
    router.push(`/game?location=${selected.id}&budget=${selected.budget}`);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(ellipse at center, #0F172A 0%, #020617 100%)' }}>
      {/* 顶部状态条 */}
      <header className="h-[72px] bg-card border-b border-border px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">竞标博弈</div>
              <div className="text-[10px] text-muted-foreground">四档难度 · 选择项目</div>
            </div>
          </div>
          <div className="text-sm">
            <div className="font-semibold text-foreground">XX市智慧政务 v3.2 · 政企竞标实训</div>
            <div className="text-[10px] text-muted-foreground">主预算 ¥580万</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 text-warning">
            <Coins className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">28 / 30</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">{meta.avatarChar}</div>
            <div className="text-xs">
              <div className="font-semibold text-foreground">{identity?.displayName || '游客'}</div>
              <div className="text-[10px] text-muted-foreground">{meta.title} · Lv.{meta.level}</div>
            </div>
          </div>
          <button className="text-muted-foreground hover:text-foreground">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 中间主舞台 */}
      <main className="flex-1 relative">
        {/* 等距图 */}
        <div className="absolute inset-0">
          <img
            src="/game-map.webp"
            alt="XX市等距城市地图"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = '/game-map.jpg'; }}
          />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(15,23,42,0.3) 0%, transparent 30%, transparent 70%, rgba(15,23,42,0.4) 100%)' }} />
        </div>

        {/* 顶部信息 */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
          <div className="px-3 py-1.5 rounded bg-card/90 backdrop-blur text-xs">
            <div className="font-semibold text-foreground">XX市 · CITY MAP</div>
            <div className="text-[10px] text-muted-foreground">ISOMETRIC VIEW · 1:800</div>
          </div>
        </div>

        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
          <button
            onClick={() => setShowBackground(!showBackground)}
            className="w-10 h-10 rounded-lg bg-card/90 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Copy className="w-4 h-4" />
          </button>
          <div className="px-2 py-1 rounded bg-card/90 backdrop-blur text-[10px] text-muted-foreground">NSEW</div>
        </div>

        {/* Hotspot */}
        {sideHotspots.map((h) => (
          <button
            key={h.id}
            onClick={() => setSelected(h)}
            className="absolute z-10 group transition-transform hover:scale-110"
            style={{ left: h.left, top: h.top, transform: 'translate(-50%, -50%)' }}
          >
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-warning/40 animate-ping" />
              <span className="relative w-14 h-14 rounded-full bg-warning border-2 border-card flex items-center justify-center shadow-xl">
                <Building2 className="w-7 h-7 text-white" />
              </span>
              <div className="absolute left-1/2 -translate-x-1/2 -top-6 whitespace-nowrap px-2 py-0.5 rounded bg-foreground/80 text-xs text-background">
                ¥{h.budget}万
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 top-16 whitespace-nowrap px-3 py-1 rounded bg-card/95 backdrop-blur text-sm font-semibold text-foreground">
                {h.name}
              </div>
            </div>
          </button>
        ))}



        {/* 详情弹窗 - 居中显示 */}
        {selected && (
          <>
            <div
              className="absolute inset-0 z-30 bg-black/20"
              onClick={() => setSelected(null)}
            />
            <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
              <div className="w-[420px] max-h-[85vh] bg-card rounded-2xl shadow-2xl flex flex-col pointer-events-auto" style={{ animation: 'modalFadeIn 200ms ease-out' }}>
                {/* 头部 - 固定 */}
                <div className="p-6 pb-4 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${selected.type === 'main' ? 'bg-warning/10' : 'bg-primary/10'}`}>
                        <Building2 className={`w-6 h-6 ${selected.type === 'main' ? 'text-warning' : 'text-primary'}`} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">{selected.name}</h2>
                        <div className="flex items-center gap-1 mt-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < selected.difficulty ? 'text-warning fill-warning' : 'text-muted-foreground/30'}`} />
                          ))}
                          <span className="text-[10px] text-muted-foreground ml-1">{selected.difficultyLabel}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 内容区 - 可滚动 */}
                <div className="px-6 overflow-y-auto flex-1 min-h-0">

                {/* 项目信息 */}
                <div className="mb-4 p-4 rounded-xl bg-surface-container">
                  <div className="text-xs text-muted-foreground mb-2">项目信息</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">项目预算</span><span className="font-semibold text-foreground">¥{selected.budget}万</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">交付周期</span><span className="font-semibold text-foreground">5 个月</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">参与竞品</span><span className="font-semibold text-foreground">3 家</span></div>
                  </div>
                </div>

                {/* 竞品公司特点表 */}
                {competitors.filter(c => c.project_id === selected.projectId).length > 0 && (
                  <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/20">
                    <div className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {competitors.filter(c => c.project_id === selected.projectId).length === 3 ? 'ABC' : 'ABCD'}公司特点表
                    </div>
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="bg-surface-container border-b border-border">
                            <th className="px-3 py-2 text-left font-semibold text-foreground">公司</th>
                            {competitors.filter(c => c.project_id === selected.projectId).map((cp, i) => (
                              <th key={i} className="px-3 py-2 text-center font-bold text-primary">{cp.company_name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-border">
                            <td className="px-3 py-2 font-semibold text-foreground">特点</td>
                            {competitors.filter(c => c.project_id === selected.projectId).map((cp, i) => (
                              <td key={i} className="px-3 py-2 text-center text-foreground/80">{cp.features}</td>
                            ))}
                          </tr>
                          <tr>
                            <td className="px-3 py-2 font-semibold text-foreground align-top">更多信息</td>
                            {competitors.filter(c => c.project_id === selected.projectId).map((cp, i) => (
                              <td key={i} className="px-3 py-2 text-center text-muted-foreground align-top">{cp.more_info || '-'}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 技术难点 */}
                <div className="mb-4">
                  <div className="text-xs font-semibold text-foreground mb-2">技术难点</div>
                  <div className="space-y-1.5">
                    {selected.technicalDifficulties.map((t, i) => (
                      <div key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 客户诉求 */}
                <div className="mb-4">
                  <div className="text-xs font-semibold text-foreground mb-2">客户核心诉求</div>
                  <div className="space-y-1.5">
                    {selected.customerNeeds.map((c, i) => (
                      <div key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-success mt-1.5 flex-shrink-0" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 决策人 */}
                <div className="mb-4 p-4 rounded-xl border border-border">
                  <div className="text-xs font-semibold text-foreground mb-2">当前已知负责人</div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-base font-bold text-primary">
                      {selected.leader.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">{selected.leader.name}</div>
                      <div className="text-[11px] text-muted-foreground">{selected.leader.title} · {selected.leader.style}</div>
                    </div>
                  </div>
                </div>

                {/* AI 战前预估 */}
                <div className="mb-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
                    <Sparkles className="w-3.5 h-3.5" /> AI 战前预估
                  </div>
                  <div className="text-[11px] text-foreground mb-3">{selected.aiAdvice}</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-muted-foreground">预期利润率</div>
                      <div className="text-sm font-bold text-primary">{selected.expectedProfit}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">胜率预估</div>
                      <div className="text-sm font-bold text-primary">{selected.winRate}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">难度系数</div>
                      <div className="text-sm font-bold text-primary">{(selected.difficulty * 0.95).toFixed(1)}</div>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 - 固定在底部 */}
                </div>
                <div className="p-6 pt-4 flex-shrink-0 border-t border-border flex gap-2">
                  <button
                    onClick={() => setSelected(null)}
                    className="flex-1 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-surface-container"
                  >
                    换个目标
                  </button>
                  <button
                    onClick={handleStart}
                    disabled={selected.id !== 'project-1'}
                    className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selected.id === 'project-1' ? '开始攻略此目标' : '本期暂未开放'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <style jsx global>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
