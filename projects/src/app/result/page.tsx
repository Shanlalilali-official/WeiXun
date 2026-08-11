'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Trophy, TrendingUp, Target, Award, ChevronRight, FileText, RefreshCw, Home, BarChart3 } from 'lucide-react';

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
  const score = Number(params.get('score') || 0);
  const intimacy = Number(params.get('intimacy') || 0);
  const coins = Number(params.get('coins') || 0);
  const round = Number(params.get('round') || 0);
  const location = params.get('location') || 'gov';

  const isWin = score >= 70;
  const dimensions = [
    { name: '信息采集', score: 82 },
    { name: '方案设计', score: 75 },
    { name: '价格博弈', score: 68 },
    { name: '关系经营', score: Math.min(95, intimacy) },
    { name: '风险控制', score: 70 },
    { name: '复盘总结', score: 72 },
  ];

  return (
    <div className="min-h-screen" style={{ background: '#F6F8FB' }}>
      <main className="max-w-5xl mx-auto px-8 py-10">
        {/* 结果卡片 */}
        <div className={`rounded-2xl p-8 mb-6 text-white ${isWin ? 'bg-gradient-to-br from-primary to-[#5C8AFF]' : 'bg-gradient-to-br from-[#637089] to-[#3E4960]'}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Trophy className="w-9 h-9" />
            </div>
            <div>
              <div className="text-sm opacity-80">本场对局结果</div>
              <h1 className="text-3xl font-bold">{isWin ? '🎉 中标！' : '本场未中标'}</h1>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div>
              <div className="text-xs opacity-80">综合得分</div>
              <div className="text-2xl font-bold">{score}<span className="text-sm opacity-70">/100</span></div>
            </div>
            <div>
              <div className="text-xs opacity-80">亲密度</div>
              <div className="text-2xl font-bold">{intimacy}<span className="text-sm opacity-70">/100</span></div>
            </div>
            <div>
              <div className="text-xs opacity-80">回合数</div>
              <div className="text-2xl font-bold">{round}<span className="text-sm opacity-70">/8</span></div>
            </div>
            <div>
              <div className="text-xs opacity-80">剩余操作点</div>
              <div className="text-2xl font-bold">{coins}</div>
            </div>
          </div>
        </div>

        {/* 6 维评分 */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">六维能力雷达</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {dimensions.map((d) => (
              <div key={d.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-foreground">{d.name}</span>
                  <span className="font-semibold text-foreground">{d.score}</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${d.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI 诊断 */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-warning" />
            <h2 className="text-base font-semibold text-foreground">AI 多维度销售能力诊断</h2>
          </div>
          <div className="space-y-2 text-sm text-foreground">
            <div className="p-3 rounded-lg bg-success/5 border border-success/20">
              <div className="text-xs font-semibold text-success mb-1">✓ 优势</div>
              <div className="text-xs">技术方案展示到位，对国产化适配背景把握精准；关系经营节奏良好，亲密度持续提升。</div>
            </div>
            <div className="p-3 rounded-lg bg-error/5 border border-error/20">
              <div className="text-xs font-semibold text-error mb-1">✗ 待改进</div>
              <div className="text-xs">价格博弈过于保守，在第 4 轮未主动亮出价格让利空间，错失决策窗口。</div>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="text-xs font-semibold text-primary mb-1">→ 下一步建议</div>
              <div className="text-xs">学习"先让利再锁单"策略，研究张副市长的决策风格是"技术先行，价格后谈"。</div>
            </div>
          </div>
        </div>

        {/* 跳转知识 */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="text-base font-semibold text-foreground mb-3">📚 知识点跳转</h2>
          <div className="grid grid-cols-3 gap-2">
            {['国产化适配', '等保三级', '高并发架构', '一网通办', '政企客户决策心理'].map((k) => (
              <button key={k} className="px-3 py-2 rounded-lg border border-border text-xs text-foreground hover:border-primary hover:bg-primary/5 text-left">
                {k} <ChevronRight className="w-3 h-3 inline ml-1" />
              </button>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/setup')}
            className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-surface-container flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> 重新开局
          </button>
          <button
            onClick={() => router.push(`/ranking?tab=room&location=${location}`)}
            className="flex-1 py-3 rounded-xl bg-warning text-white font-semibold hover:bg-warning/90 flex items-center justify-center gap-2"
          >
            <Trophy className="w-4 h-4" /> 查看排行榜
          </button>
          <button
            onClick={() => router.push('/')}
            className="flex-1 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-surface-container flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> 回到首页
          </button>
          <button
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" /> 下载报告
          </button>
        </div>
      </main>
    </div>
  );
}
