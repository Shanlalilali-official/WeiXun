'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Building2,
  Clock3,
  FileCheck2,
  FileText,
  Gift,
  HeartHandshake,
  Home,
  MessagesSquare,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserRound,
  Users,
} from 'lucide-react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { calculateTotalScore, getGameOutcome, type GameDimension, type GameRuntimeState } from '@/lib/game/state';
import { getProjectOneNpc } from '@/lib/game/project-one';
import type { GameReview } from '@/lib/contracts/game';

const DIMENSION_LABELS: Record<GameDimension, string> = {
  decisionAnalysis: '分析决策',
  relationshipBuilding: '关系建立',
  valuePresentation: '价值呈现',
  objectionHandling: '异议处理',
  informationDiscovery: '提问挖掘',
};
const GIFT_OUTCOME_LABELS: Record<string, string> = {
  delighted_acceptance: '愉快接受，产生了较高即时收益',
  cautious_acceptance: '谨慎接受，同时留下隐藏风险',
  polite_decline: '婉拒，本次没有获得礼品收益',
  firm_rejection: '明确拒绝，并对关系造成负面影响',
  reported: '拒绝并上报，风险立即扩散',
};
const RISK_STATUS_LABELS: Record<string, string> = {
  latent: '风险潜伏',
  triggered: '风险已触发',
  resolved: '已处置',
  exposed: '已暴露',
  hidden: '暂未暴露',
  reported: '已上报',
  rejected: '已拒收',
};

interface OutcomeView {
  fiveDimensionScore?: number;
  publicValueScore?: number;
  personalBenefitScore?: number;
  decisionChainSupport?: number;
  baseScore?: number;
  compliancePenalty?: number;
  finalScore?: number;
  eligible?: boolean;
  won?: boolean;
}

interface AttitudeView {
  npcId: string;
  pleasantness?: number;
  support?: number;
  unmetImpression?: number;
  complianceAwareness?: number;
  history: Array<{ round: number; pleasantnessDelta: number; supportDelta: number; reason: string }>;
}

interface ComplianceView {
  id: string;
  npcId?: string;
  title: string;
  giftType?: string;
  status: string;
  description: string;
  immediateEffect?: string;
  delayedEffect?: string;
  penalty?: number;
}

interface EvidenceView {
  id: string;
  category: 'public' | 'personal';
  text: string;
  source?: string;
  confirmed: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstRecord(source: Record<string, unknown> | null, keys: string[]): Record<string, unknown> | null {
  if (!source) return null;
  for (const key of keys) {
    const value = asRecord(source[key]);
    if (value) return value;
  }
  return null;
}

function firstArray(source: Record<string, unknown> | null, keys: string[]): unknown[] {
  if (!source) return [];
  for (const key of keys) if (Array.isArray(source[key])) return source[key] as unknown[];
  return [];
}

function firstNumber(source: Record<string, unknown> | null, keys: string[]): number | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function firstString(source: Record<string, unknown> | null, keys: string[], fallback = ''): string {
  if (!source) return fallback;
  for (const key of keys) if (typeof source[key] === 'string') return source[key] as string;
  return fallback;
}

function clampScore(value: number | undefined): number | undefined {
  return typeof value === 'number' ? Math.max(0, Math.min(100, Math.round(value))) : undefined;
}

function clampOutcomeScore(value: number | undefined): number | undefined {
  return typeof value === 'number'
    ? Math.max(0, Math.min(100, Math.round(value * 10) / 10))
    : undefined;
}

function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  return hours ? `${hours}小时${remainder ? `${remainder}分` : ''}` : `${remainder}分钟`;
}

function normalizeOutcome(value: unknown, fallbackFiveDimension: number): OutcomeView {
  const raw = asRecord(value);
  const fiveDimensionScore = clampOutcomeScore(firstNumber(raw, ['fiveDimensionScore', 'abilityScore', 'salesCapability'])) ?? fallbackFiveDimension;
  const publicValueScore = clampOutcomeScore(firstNumber(raw, ['publicValueScore', 'publicValue', 'organizationalValue']));
  const personalBenefitScore = clampOutcomeScore(firstNumber(raw, ['personalBenefitScore', 'personalBenefit', 'individualBenefit']));
  const decisionChainSupport = clampOutcomeScore(firstNumber(raw, ['decisionChainSupportScore', 'decisionChainSupport', 'supportScore']));
  const compliancePenalty = Math.max(0, Math.min(30, Math.round(firstNumber(raw, ['compliancePenalty', 'riskPenalty']) ?? 0)));
  const calculatedBase = publicValueScore !== undefined && personalBenefitScore !== undefined && decisionChainSupport !== undefined
    ? Math.round(fiveDimensionScore * 0.4 + publicValueScore * 0.3 + personalBenefitScore * 0.2 + decisionChainSupport * 0.1)
    : undefined;
  const baseScore = clampOutcomeScore(firstNumber(raw, ['baseScore'])) ?? calculatedBase;
  const finalScore = clampOutcomeScore(firstNumber(raw, ['finalScore', 'score'])) ?? (baseScore !== undefined ? Math.max(0, baseScore - compliancePenalty) : fallbackFiveDimension);
  return {
    fiveDimensionScore,
    publicValueScore,
    personalBenefitScore,
    decisionChainSupport,
    baseScore,
    compliancePenalty,
    finalScore,
    eligible: typeof raw?.eligible === 'boolean' ? raw.eligible : undefined,
    won: typeof raw?.won === 'boolean' ? raw.won : undefined,
  };
}

function getAttitudes(state: GameRuntimeState): AttitudeView[] {
  const attitudes = firstRecord(asRecord(state), ['npcAttitudes', 'attitudes']);
  if (!attitudes) {
    return Object.entries(state.npcAffinity ?? {}).map(([npcId, support]) => ({ npcId, support, history: [] }));
  }
  return Object.entries(attitudes).map(([npcId, rawValue]) => {
    const value = asRecord(rawValue);
    const history = firstArray(value, ['history', 'changes']).map((historyItem) => {
      const item = asRecord(historyItem);
      return {
        round: firstNumber(item, ['round', 'stage']) ?? 0,
        pleasantnessDelta: firstNumber(item, ['pleasantnessDelta', 'moodDelta']) ?? 0,
        supportDelta: firstNumber(item, ['supportDelta']) ?? 0,
        reason: firstString(item, ['reason', 'summary'], '本轮互动改变了人物态度'),
      };
    });
    return {
      npcId,
      pleasantness: clampScore(firstNumber(value, ['pleasantness', 'mood', 'happiness'])),
      support: clampScore(firstNumber(value, ['support', 'supportLevel', 'affinity'])),
      unmetImpression: firstNumber(value, ['unmetImpression', 'indirectImpression']),
      complianceAwareness: clampScore(firstNumber(value, ['complianceAwareness', 'riskAwareness'])),
      history,
    };
  });
}

function getComplianceEvents(state: GameRuntimeState): ComplianceView[] {
  const raw = firstArray(asRecord(state), ['complianceRisks', 'complianceEvents', 'riskEvents']);
  return raw.map((entry, index) => {
    const item = asRecord(entry);
    const giftType = firstString(item, ['giftType', 'preparationType', 'type', 'kind']);
    const outcome = firstString(item, ['outcome', 'disposition']);
    const exposed = typeof item?.exposed === 'boolean' ? item.exposed : undefined;
    const status = firstString(item, ['status', 'outcome'], exposed === true ? 'exposed' : exposed === false ? 'hidden' : 'recorded');
    return {
      id: firstString(item, ['id', 'riskId'], `risk-${index}`),
      npcId: firstString(item, ['npcId']) || undefined,
      title: firstString(item, ['title'], giftType === 'boundary_gift' ? '高波动边界礼品' : '合规风险事件'),
      giftType: giftType || undefined,
      status,
      description: firstString(item, ['description', 'reason', 'summary'], '本次行为留下了合规风险记录。'),
      immediateEffect: firstString(item, ['immediateEffect', 'shortTermEffect']) || GIFT_OUTCOME_LABELS[outcome] || undefined,
      delayedEffect: firstString(item, ['delayedEffect', 'consequence']) || (status === 'triggered' ? '隐藏风险已在后续阶段触发，并进入最终结算。' : undefined),
      penalty: firstNumber(item, ['penalty', 'scorePenalty']),
    };
  });
}

function evidenceItems(rawValue: unknown, category: EvidenceView['category']): EvidenceView[] {
  if (!Array.isArray(rawValue)) return [];
  return rawValue.map((raw, index) => {
    if (typeof raw === 'string') return { id: `${category}-${index}`, category, text: raw, confirmed: true };
    const item = asRecord(raw);
    return {
      id: firstString(item, ['id', 'evidenceId'], `${category}-${index}`),
      category,
      text: firstString(item, ['statement', 'text', 'content', 'summary', 'claim'], '已记录一条项目证据'),
      source: firstString(item, ['sourceNpcName', 'npcId', 'source']) || undefined,
      confirmed: typeof item?.confirmed === 'boolean' ? item.confirmed : firstString(item, ['status'], 'confirmed') !== 'unconfirmed',
    };
  });
}

function getEvidence(state: GameRuntimeState): EvidenceView[] {
  const evidence = firstRecord(asRecord(state), ['outcomeEvidence', 'evidenceLedger']);
  return [
    ...evidenceItems(evidence?.publicValue, 'public'),
    ...evidenceItems(evidence?.personalBenefit, 'personal'),
  ];
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center text-slate-500">正在生成赛后报告...</div>}>
      <ResultInner />
    </Suspense>
  );
}

function ResultInner() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get('sessionId') || '';
  const [state, setState] = useState<GameRuntimeState | null>(null);
  const [outcomeSource, setOutcomeSource] = useState<unknown>(null);
  const [review, setReview] = useState<GameReview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setError('缺少对局标识');
      return;
    }
    fetch(`/api/game/sessions/${sessionId}`, { headers: { 'x-session': localStorage.getItem('weixun_session') || '' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('无法读取本局结果');
        return response.json();
      })
      .then(async (data) => {
        const restoredState: GameRuntimeState = data.gameSession.state;
        setState(restoredState);
        const stateRecord = asRecord(restoredState);
        setOutcomeSource(data.gameSession.outcome ?? data.outcome ?? stateRecord?.outcome ?? stateRecord?.gameOutcome ?? stateRecord?.result);
        if (restoredState.status !== 'playing') {
          try {
            const response = await fetch(`/api/game/sessions/${sessionId}/review`, { method: 'POST', headers: { 'x-session': localStorage.getItem('weixun_session') || '' } });
            if (response.ok) setReview((await response.json()).review);
          } catch {
            // AI复盘失败时仍展示可复算的确定性结果。
          }
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : '结果加载失败'));
  }, [sessionId]);

  const dimensions = useMemo(() => state
    ? Object.entries(state.dimensions).map(([key, score]) => ({ key: key as GameDimension, name: DIMENSION_LABELS[key as GameDimension], score }))
    : [], [state]);

  if (error) return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
  if (!state) return <div className="min-h-screen flex items-center justify-center text-slate-500">正在读取真实对局数据...</div>;

  const fiveDimensionFallback = calculateTotalScore(state.dimensions);
  const outcome = normalizeOutcome(outcomeSource ?? getGameOutcome(state), fiveDimensionFallback);
  const finalScore = outcome.finalScore ?? fiveDimensionFallback;
  const isWin = outcome.won ?? outcome.eligible ?? state.status === 'won';
  const strongest = dimensions.reduce((best, item) => item.score > best.score ? item : best, dimensions[0]);
  const weakest = dimensions.reduce((worst, item) => item.score < worst.score ? item : worst, dimensions[0]);
  const attitudes = getAttitudes(state);
  const complianceEvents = getComplianceEvents(state);
  const evidence = getEvidence(state);
  const root = asRecord(state);
  const cumulativeTime = firstNumber(root, ['cumulativeTimeMinutes', 'totalInvestedMinutes']) ?? 0;
  const cumulativeSpent = firstNumber(root, ['cumulativeSpentPoints', 'totalActionPointsSpent']) ?? 0;
  const completeHybridData = outcome.publicValueScore !== undefined && outcome.personalBenefitScore !== undefined && outcome.decisionChainSupport !== undefined;
  const decisionReplay = attitudes.map((attitude) => {
    const npc = getProjectOneNpc(attitude.npcId);
    const support = attitude.support ?? 0;
    const stance = support >= 60 ? '支持我方方案' : support >= 45 ? '谨慎认可，仍要求补证' : '保留意见';
    const reason = attitude.history[attitude.history.length - 1]?.reason ?? '本局没有形成更明确的直接证据';
    return { npcId: attitude.npcId, name: npc?.name ?? attitude.npcId, title: npc?.title ?? '关键联系人', stance, reason };
  });
  const restartGame = () => {
    localStorage.removeItem(`game-session:${state.scenarioCode}`);
    router.push('/start');
  };

  const outcomeCards = [
    { label: '五维能力', value: outcome.fiveDimensionScore, weight: '40%', icon: BarChart3, color: 'blue' },
    { label: '对公价值', value: outcome.publicValueScore, weight: '30%', icon: Building2, color: 'emerald' },
    { label: '个人合理收益', value: outcome.personalBenefitScore, weight: '20%', icon: HeartHandshake, color: 'amber' },
    { label: '决策链支持', value: outcome.decisionChainSupport, weight: '10%', icon: Users, color: 'violet' },
  ] as const;

  return (
    <div className="min-h-screen bg-app-shell text-foreground">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <section className={`overflow-hidden rounded-3xl p-7 text-white shadow-2xl ${isWin ? 'bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700' : 'bg-gradient-to-br from-slate-700 to-slate-900'}`}>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><Trophy className="h-9 w-9" /></div>
              <div><div className="text-sm text-white/70">项目一 · 赛后复盘</div><h1 className="mt-1 text-3xl font-bold">{isWin ? '中标' : '本场未中标'}</h1><div className="mt-2 text-xs text-white/70">最终结果由销售能力、客户价值、个人合理收益、决策链支持与合规风险共同决定。</div></div>
            </div>
            <div className="flex items-end gap-6">
              <div><div className="text-xs text-white/60">最终得分</div><div className="text-4xl font-black num">{finalScore}<span className="text-base font-medium text-white/60"> / 100</span></div></div>
              {(outcome.compliancePenalty ?? 0) > 0 && <div className="rounded-xl bg-red-500/25 px-4 py-3"><div className="text-[10px] text-white/70">合规扣分</div><div className="text-xl font-bold">-{outcome.compliancePenalty}</div></div>}
            </div>
          </div>
          <div className="mt-6 grid gap-3 border-t border-white/15 pt-5 sm:grid-cols-4">
            <SummaryStat icon={Target} label="基础结果" value={outcome.baseScore !== undefined ? `${outcome.baseScore}分` : '旧存档'} />
            <SummaryStat icon={Clock3} label="累计投入" value={cumulativeTime ? formatDuration(cumulativeTime) : `${state.currentRound}/${state.maxRounds}阶段`} />
            <SummaryStat icon={Sparkles} label="累计行动点" value={cumulativeSpent ? `${cumulativeSpent}点` : `剩余${state.actionPoints}点`} />
            <SummaryStat icon={FileCheck2} label="确认价值证据" value={`${evidence.filter((item) => item.confirmed).length}条`} />
          </div>
        </section>

        {!completeHybridData && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            这是旧版或迁移中的对局，部分「对公价值、个人合理收益、决策链支持」数据尚未记录。已保留原五维结果，不会用虚构数值补齐缺失项。
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm card-elevated">
          <div className="flex items-center gap-2"><Swords className="h-5 w-5 text-red-600" /><h2 className="text-base font-bold">竞品最终对比</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">竞品过程分属于后台推演依据，不向玩家公开。以下只说明客户决策中可被行为证据支持的竞争影响。</p>
          <div className="mt-4 rounded-xl border border-border bg-surface-container p-4 text-sm leading-6 text-slate-700">{isWin ? '我方在关键人物支持、客户价值证据或履约表现上形成了更有效的综合优势。' : '客户最终更倾向竞品；请结合下方决策回放检查未核实的信息、未回应的异议和缺失的关键人支持。'}</div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm card-elevated">
          <div className="flex items-center gap-2"><MessagesSquare className="h-5 w-5 text-violet-600" /><h2 className="text-base font-bold">客户内部决策回放</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">根据各关键人最终支持度和最近态度转折生成，便于追溯“为什么支持或保留”。</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{decisionReplay.map((item) => <article key={item.npcId} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-bold">{item.name}</div><div className="text-[10px] text-muted-foreground">{item.title}</div></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.stance.startsWith('支持') ? 'bg-emerald-50 text-emerald-700' : item.stance.startsWith('谨慎') ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{item.stance}</span></div><p className="mt-3 text-xs leading-5 text-slate-600">核心依据：{item.reason}</p></article>)}</div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm card-elevated">
          <div className="flex items-center gap-2"><Award className="h-5 w-5 text-blue-600" /><h2 className="text-base font-bold">混合结果构成</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">基础分 = 五维能力×40% + 对公价值×30% + 个人合理收益×20% + 决策链支持×10%；最终分再扣除已触发的合规风险。</p>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {outcomeCards.map((item) => <MetricCard key={item.label} {...item} />)}
          </div>
          {(outcome.baseScore !== undefined || outcome.compliancePenalty !== undefined) && <div className="mt-5 flex flex-wrap items-center justify-center gap-3 rounded-xl bg-surface-container p-4 text-sm"><span>基础分 <strong>{outcome.baseScore ?? '—'}</strong></span><span className="text-muted-foreground/40">−</span><span>合规惩罚 <strong className="text-destructive">{outcome.compliancePenalty ?? 0}</strong></span><span className="text-muted-foreground/40">=</span><span>最终分 <strong className="text-primary">{finalScore}</strong></span></div>}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm card-elevated">
            <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" /><h2 className="text-base font-bold">五维销售能力</h2></div>
            <div className="mt-4 h-64 w-full" aria-label="五维销售能力雷达图">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={dimensions} outerRadius="72%">
                  <PolarGrid stroke="#CBD5E1" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="能力得分" dataKey="score" stroke="#2563EB" fill="#3B82F6" fillOpacity={0.28} />
                  <Tooltip formatter={(value) => [`${Number(value)}分`, '能力得分']} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-3">
              {dimensions.map((dimension) => <ScoreBar key={dimension.key} label={dimension.name} value={dimension.score} />)}
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm card-elevated">
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-violet-600" /><h2 className="text-base font-bold">人物态度揭示</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">对局中隐藏的愉悦度与项目支持度在此揭示；愉悦度不直接计入最终分。</p>
            <div className="mt-4 max-h-[330px] space-y-3 overflow-y-auto pr-1">
              {attitudes.length === 0 && <EmptyReport text="本局没有可展示的人物态度记录。" />}
              {attitudes.map((attitude) => {
                const npc = getProjectOneNpc(attitude.npcId);
                return <div key={attitude.npcId} className="rounded-xl border border-border p-3 hover:border-primary/30 transition-colors"><div className="mb-3 flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 font-bold text-white">{npc?.name.slice(0, 1) ?? <UserRound className="h-4 w-4" />}</div><div><div className="text-xs font-bold">{npc?.name ?? attitude.npcId}</div><div className="text-[10px] text-muted-foreground">{npc?.title ?? '关键联系人'}</div></div></div>{attitude.pleasantness !== undefined ? <ScoreBar label="愉悦度" value={attitude.pleasantness} compact color="amber" /> : <div className="mb-2 text-[10px] text-muted-foreground">愉悦度：旧存档未记录</div>}<ScoreBar label={attitude.pleasantness === undefined ? '支持度（旧关系值兼容）' : '支持度'} value={attitude.support ?? 0} compact color="violet" />{(attitude.unmetImpression !== undefined || attitude.complianceAwareness !== undefined) && <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-muted-foreground">{attitude.unmetImpression !== undefined && <span className="rounded-full bg-surface-container px-2 py-1">初见前印象 {attitude.unmetImpression >= 0 ? '+' : ''}{attitude.unmetImpression}</span>}{attitude.complianceAwareness !== undefined && <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">合规警觉 {attitude.complianceAwareness}</span>}</div>}{attitude.history.length > 0 && <div className="mt-3 border-t border-border pt-2"><div className="mb-1 text-[9px] font-bold text-muted-foreground">最近态度转折</div>{attitude.history.slice(-2).map((item, index) => <div key={`${item.round}-${index}`} className="mt-1 text-[9px] leading-4 text-muted-foreground">第{item.round}阶段 · 愉悦{item.pleasantnessDelta >= 0 ? '+' : ''}{item.pleasantnessDelta} / 支持{item.supportDelta >= 0 ? '+' : ''}{item.supportDelta}：{item.reason}</div>)}</div>}</div>;
              })}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm card-elevated">
            <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-emerald-600" /><h2 className="text-base font-bold">价值证据账本</h2></div>
            <div className="mt-4 space-y-4">
              {(['public', 'personal'] as const).map((category) => {
                const items = evidence.filter((item) => item.category === category);
                return <div key={category}><div className="mb-2 text-xs font-bold">{category === 'public' ? '对公价值' : '个人合理收益'}</div>{items.length === 0 ? <div className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">本局尚未形成可验证证据</div> : <div className="space-y-2">{items.map((item) => { const sourceNpc = item.source ? getProjectOneNpc(item.source) : null; return <div key={item.id} className={`rounded-xl border p-3 text-xs ${item.confirmed ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-surface-container'}`}><div className="flex items-start gap-2"><FileCheck2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${item.confirmed ? 'text-emerald-600' : 'text-muted-foreground'}`} /><span>{item.text}</span></div>{item.source && <div className="mt-1 pl-5 text-[10px] text-muted-foreground">来源：{sourceNpc?.name ?? item.source}</div>}</div>; })}</div>}</div>;
              })}
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-6 shadow-sm card-elevated">
            <div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-600" /><h2 className="text-base font-bold">礼品与合规事件</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">高波动礼品的即时收益与延迟代价在这里一并复盘。</p>
            <div className="mt-4 space-y-3">
              {complianceEvents.length === 0 && <EmptyReport text="本局没有记录到合规风险事件。" />}
              {complianceEvents.map((event) => <div key={event.id} className={`rounded-xl border p-4 ${['triggered', 'exposed', 'reported', 'rejected'].includes(event.status) ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><Gift className="h-4 w-4" /><span className="text-xs font-bold">{event.title}</span></div><span className="rounded-full bg-white/70 px-2 py-0.5 text-[9px]">{RISK_STATUS_LABELS[event.status] ?? event.status}</span></div><p className="mt-2 text-[11px] leading-5">{event.description}</p>{event.immediateEffect && <div className="mt-2 text-[10px] text-emerald-700">即时：{event.immediateEffect}</div>}{event.delayedEffect && <div className="mt-1 text-[10px] text-red-700">后续：{event.delayedEffect}</div>}{event.penalty !== undefined && <div className="mt-2 text-[10px] font-bold text-red-700">结算扣分：{event.penalty}</div>}</div>)}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm card-elevated">
          <div className="flex items-center gap-2"><Award className="h-5 w-5 text-amber-500" /><h2 className="text-base font-bold">基于本局数据的诊断</h2></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <DiagnosisCard title="当前优势" tone="success" text={review?.strengths.join('；') || `${strongest.name}为本局最高维度（${strongest.score}分），可回看对应对话与准备动作并固化做法。`} />
            <DiagnosisCard title="优先改进" tone="danger" text={review?.improvements.join('；') || `${weakest.name}为本局最低维度（${weakest.score}分），下一局应围绕该能力设定明确行动目标。`} />
            <DiagnosisCard title="下一步建议" tone="primary" text={review?.nextActions.join('；') || (evidence.length === 0 ? '不要只追求关系热度；应让NPC明确认可对公价值与个人合理收益，并形成可验证证据。' : '复盘关键人物的真实顾虑，围绕缺失证据设计下一次邀约、材料与方案陈述。')} />
          </div>
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button onClick={restartGame} className="flex items-center justify-center gap-2 rounded-xl btn-glass py-3 text-sm font-semibold text-foreground"><RefreshCw className="h-4 w-4" />重新开局</button>
          <button onClick={() => router.push('/ranking')} className="flex items-center justify-center gap-2 rounded-xl btn-warning py-3 text-sm font-semibold"><Trophy className="h-4 w-4" />查看排行榜</button>
          <button onClick={() => router.push('/')} className="flex items-center justify-center gap-2 rounded-xl btn-glass py-3 text-sm font-semibold text-foreground"><Home className="h-4 w-4" />回到首页</button>
          <button onClick={() => window.print()} className="flex items-center justify-center gap-2 rounded-xl btn-primary py-3 text-sm font-semibold"><FileText className="h-4 w-4" />打印报告</button>
        </div>
      </main>
    </div>
  );
}

function SummaryStat({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return <div className="rounded-xl bg-white/10 p-3"><div className="flex items-center gap-1.5 text-[10px] text-white/65"><Icon className="h-3.5 w-3.5" />{label}</div><div className="mt-1 text-lg font-bold">{value}</div></div>;
}

function ComparisonScore({ label, value, winner, tone }: { label: string; value: number; winner: boolean; tone: 'blue' | 'red' }) {
  const color = tone === 'blue' ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-red-200 bg-red-50 text-red-900';
  return <div className={`rounded-2xl border p-5 ${color}`}><div className="flex items-center justify-between"><span className="text-sm font-bold">{label}</span>{winner && <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold">领先</span>}</div><div className="mt-3 text-4xl font-black">{value}<span className="text-sm font-medium opacity-60"> / 100</span></div></div>;
}

function MetricCard({ label, value, weight, icon: Icon, color }: { label: string; value?: number; weight: string; icon: typeof Trophy; color: 'blue' | 'emerald' | 'amber' | 'violet' }) {
  const colorClasses = { blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700', violet: 'bg-violet-50 text-violet-700' };
  return <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${colorClasses[color]}`}><Icon className="h-4 w-4" /></div><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">权重 {weight}</span></div><div className="mt-4 text-xs text-slate-500">{label}</div><div className="mt-1 text-2xl font-black">{value ?? '—'}{value !== undefined && <span className="text-xs font-medium text-slate-400"> / 100</span>}</div></div>;
}

function ScoreBar({ label, value, compact = false, color = 'blue' }: { label: string; value: number; compact?: boolean; color?: 'blue' | 'amber' | 'violet' }) {
  const barColor = color === 'amber' ? 'bg-amber-500' : color === 'violet' ? 'bg-violet-500' : 'bg-blue-600';
  return <div className={compact ? 'mb-2' : ''}><div className={`mb-1 flex justify-between ${compact ? 'text-[10px]' : 'text-xs'}`}><span className="text-slate-600">{label}</span><strong>{value}</strong></div><div className={`${compact ? 'h-1.5' : 'h-2'} overflow-hidden rounded-full bg-slate-100`}><div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>;
}

function DiagnosisCard({ title, text, tone }: { title: string; text: string; tone: 'success' | 'danger' | 'primary' }) {
  const classes = tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : tone === 'danger' ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-800';
  return <div className={`rounded-xl border p-4 ${classes}`}><div className="text-xs font-bold">{title}</div><div className="mt-2 text-[11px] leading-5 text-slate-700">{text}</div></div>;
}

function EmptyReport({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-[11px] text-slate-500">{text}</div>;
}
