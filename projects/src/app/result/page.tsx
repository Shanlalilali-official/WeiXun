'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Trophy, Award, ChevronRight, FileText, RefreshCw, Home, BarChart3, BookOpen } from 'lucide-react';
import { calculateTotalScore, type GameDimension, type GameRuntimeState } from '@/lib/game/state';
import type { GameReview } from '@/lib/contracts/game';

const DIMENSION_LABELS: Record<GameDimension, string> = {
  decisionAnalysis: '分析决策',
  relationshipBuilding: '关系建立',
  valuePresentation: '价值呈现',
  objectionHandling: '异议处理',
  informationDiscovery: '提问挖掘',
};

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">加载中...</div>}>
      <ResultInner />
    </Suspense>
  );
}

function ResultInner() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get('sessionId') || '';
  const [state, setState] = useState<GameRuntimeState | null>(null);
  const [review, setReview] = useState<GameReview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) {
      setError('缺少对局标识');
      return;
    }
    fetch(`/api/game/sessions/${sessionId}`, {
      headers: { 'x-session': localStorage.getItem('coze_session') || '' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('无法读取本局结果');
        return response.json();
      })
      .then(async (data) => {
        setState(data.gameSession.state);
        if (data.gameSession.state.status !== 'playing') {
          try {
            const reviewResponse = await fetch(`/api/game/sessions/${sessionId}/review`, {
              method: 'POST',
              headers: { 'x-session': localStorage.getItem('coze_session') || '' },
            });
            if (reviewResponse.ok) {
              const reviewData = await reviewResponse.json();
              setReview(reviewData.review);
            }
          } catch {
            // 复盘失败时保留确定性诊断，不能阻断真实结果展示。
          }
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : '结果加载失败'));
  }, [sessionId]);

  const dimensions = useMemo(() => state
    ? Object.entries(state.dimensions).map(([key, score]) => ({
        key: key as GameDimension,
        name: DIMENSION_LABELS[key as GameDimension],
        score,
      }))
    : [], [state]);
  const strongest = dimensions.reduce((best, item) => item.score > best.score ? item : best, dimensions[0]);
  const weakest = dimensions.reduce((worst, item) => item.score < worst.score ? item : worst, dimensions[0]);

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-error">{error}</div>;
  }
  if (!state) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">正在读取真实对局数据...</div>;
  }

  const score = calculateTotalScore(state.dimensions);
  const isWin = state.status === 'won';
  const highestAffinity = Math.max(...Object.values(state.npcAffinity), 0);
  const restartGame = () => {
    localStorage.removeItem(`game-session:${state.scenarioCode}`);
    router.push('/start');
  };

  return (
    <div className="min-h-screen" style={{ background: '#F6F8FB' }}>
      <main className="max-w-5xl mx-auto px-8 py-10">
        <div className={`rounded-2xl p-8 mb-6 text-white ${isWin ? 'bg-gradient-to-br from-primary to-[#5C8AFF]' : 'bg-gradient-to-br from-[#637089] to-[#3E4960]'}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center"><Trophy className="w-9 h-9" /></div>
            <div><div className="text-sm opacity-80">本场对局结果</div><h1 className="text-3xl font-bold">{isWin ? '中标' : '本场未中标'}</h1></div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div><div className="text-xs opacity-80">综合得分</div><div className="text-2xl font-bold">{score}<span className="text-sm opacity-70">/100</span></div></div>
            <div><div className="text-xs opacity-80">最高关系值</div><div className="text-2xl font-bold">{highestAffinity}<span className="text-sm opacity-70">/100</span></div></div>
            <div><div className="text-xs opacity-80">完成轮次</div><div className="text-2xl font-bold">{state.currentRound}<span className="text-sm opacity-70">/{state.maxRounds}</span></div></div>
            <div><div className="text-xs opacity-80">剩余操作点</div><div className="text-2xl font-bold">{state.actionPoints}</div></div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <div className="flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-primary" /><h2 className="text-base font-semibold text-foreground">五维能力评分</h2></div>
          <div className="grid grid-cols-2 gap-3">
            {dimensions.map((dimension) => (
              <div key={dimension.key}>
                <div className="flex justify-between text-xs mb-1"><span className="text-foreground">{dimension.name}</span><span className="font-semibold text-foreground">{dimension.score}</span></div>
                <div className="h-2 rounded-full bg-surface-container overflow-hidden"><div className="h-full bg-primary" style={{ width: `${dimension.score}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <div className="flex items-center gap-2 mb-3"><Award className="w-5 h-5 text-warning" /><h2 className="text-base font-semibold text-foreground">基于本局数据的诊断</h2></div>
          <div className="space-y-2 text-sm text-foreground">
            <div className="p-3 rounded-lg bg-success/5 border border-success/20"><div className="text-xs font-semibold text-success mb-1">当前优势</div><div className="text-xs">{review?.strengths.join('；') || `${strongest.name}为本局最高维度（${strongest.score}分），可复盘对应对话与动作并固化做法。`}</div></div>
            <div className="p-3 rounded-lg bg-error/5 border border-error/20"><div className="text-xs font-semibold text-error mb-1">优先改进</div><div className="text-xs">{review?.improvements.join('；') || `${weakest.name}为本局最低维度（${weakest.score}分），下一局应围绕该能力设定明确行动目标。`}</div></div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20"><div className="text-xs font-semibold text-primary mb-1">下一步建议</div><div className="text-xs">{review?.nextActions.join('；') || `项目一需要综合分至少60、获得决策流程线索，并将关键中层关系值提升到45以上；本局共解锁${state.unlockedClues.length}条线索。`}</div></div>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" />知识点跳转</h2>
          <div className="grid grid-cols-3 gap-2">
            {['决策流程识别', '关键人关系经营', '价值量化呈现', '异议处理', '需求提问'].map((item) => (
              <button key={item} onClick={() => router.push('/knowledge')} className="px-3 py-2 rounded-lg border border-border text-xs text-foreground hover:border-primary hover:bg-primary/5 text-left">{item}<ChevronRight className="w-3 h-3 inline ml-1" /></button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={restartGame} className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-surface-container flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" />重新开局</button>
          <button onClick={() => router.push('/ranking')} className="flex-1 py-3 rounded-xl bg-warning text-white font-semibold hover:bg-warning/90 flex items-center justify-center gap-2"><Trophy className="w-4 h-4" />查看排行榜</button>
          <button onClick={() => router.push('/')} className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-surface-container flex items-center justify-center gap-2"><Home className="w-4 h-4" />回到首页</button>
          <button onClick={() => window.print()} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 flex items-center justify-center gap-2"><FileText className="w-4 h-4" />打印报告</button>
        </div>
      </main>
    </div>
  );
}
