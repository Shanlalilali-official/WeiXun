'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Building2, Send, Gift, Coffee, Calendar, FileText, Building, Package, Video, Sparkles, ChevronRight, Target, Trophy, X, Mic, MicOff } from 'lucide-react';
import { calculateTotalScore, type GameRuntimeState } from '@/lib/game/state';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: number;
}

interface CompetitorProfile {
  company_name: string;
  features: string;
  more_info: string;
  project_id: number;
}

interface NpcProfile {
  id: string;
  project_id: number;
  category: string;
  name: string;
  title: string;
  gender: string;
  age: number | null;
  hometown: string;
  personality: string;
  weakness: string | null;
}

interface SpeechRecognitionResultEventLike {
  results: ArrayLike<{ 0: { transcript: string } }>;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const ACTIONS = [
  { id: 'gift', name: '送礼品', icon: Gift, cost: 5 },
  { id: 'dinner', name: '请客吃饭', icon: Coffee, cost: 8 },
  { id: 'tea', name: '约茶叙', icon: Calendar, cost: 6 },
  { id: 'festival', name: '节日祝福', icon: Sparkles, cost: 3 },
  { id: 'roadshow', name: '产品路演', icon: FileText, cost: 10 },
  { id: 'visit', name: '邀请参观', icon: Building, cost: 12 },
  { id: 'sample', name: '寄送样品', icon: Package, cost: 4 },
  { id: 'video', name: '视频会议', icon: Video, cost: 7 },
];

const SCENE_INFO: Record<string, { name: string; budget: number; leader: string; style: string; difficulty: number; description: string; requirements?: string[] }> = {
  'project-1': { 
    name: '项目一 · 单单位内部竞标', 
    budget: 100, 
    leader: '赵峰',
    style: '老虎型', 
    difficulty: 1,
    description: 'XX单位发布年度办公配套升级采购项目，预算固定，日常使用需求清晰。单位内部人员层级简单，近期完成管理层调整，新任分管领导刚接手相关业务。你作为外部供应商销售，仅掌握基层、采购与新任分管领导的基础人脉，项目相关决策流程仍需进一步摸清。',
    requirements: ['攻关资深中层', '解锁隐藏人物', '了解决策流程', '击败ABC竞品', '好感度达标']
  },
  'project-2': { 
    name: '项目二 · 国产化改造项目', 
    budget: 300, 
    leader: '陈主任', 
    style: '老虎型（极度自负）', 
    difficulty: 2,
    description: '依据国产化替代相关政策要求，甲方单位计划对现有进口设备开展整体改造升级工程。项目技术改造难度大，落地验收标准严苛，甲方委托外部专业设计院全程负责方案设计、技术评审工作，设计院需承担全部项目技术风险。市场多家厂商同步参与本次项目竞标，竞争较为激烈。',
    requirements: ['攻关设计院主任', '技术方案认可', '双主体并行', '击败ABCD竞品', '技术一票否决']
  },
  'project-3': { 
    name: '项目三 · 大型央企升级项目', 
    budget: 1000, 
    leader: '周副总工', 
    style: '老虎型（极度自负）', 
    difficulty: 3,
    description: '某大型央企启动千万级全新设备整体升级项目，项目覆盖生产、技术、采购等多个内部平级部门，单位多层高管分管不同业务板块，内部部门相互制衡。项目信息对外管控严格，普通销售难以直接对接高层领导，本地有长期合作服务商与单位内部人员往来密切，同时单位一把手亲属常在内部出入。多家头部竞品同步参与本次竞标。',
    requirements: ['中间人搭桥', '解锁高层', '多部门制衡', '击败ABC竞品', '双线选择']
  },
  'project-4': { 
    name: '项目四 · 一体化总包解决方案', 
    budget: 200, 
    leader: '钱副局长', 
    style: '老虎型', 
    difficulty: 4,
    description: '甲方单位对外发起标准化物资采购招标，仅采购单一品类货物，技术门槛低，多家供应商参与竞标。当前市场竞品报价分化明显，有竞争对手主打极致低价，在单品价格上形成碾压优势。你与各家竞品的客情基础基本持平，仅靠原有采购清单内的产品竞争，很难拿下项目，你需要重新挖掘客户潜在需求，寻找破局之路。',
    requirements: ['挖掘隐性痛点', '方案价值重塑', '一体化总包', '击败低价竞品', '长期运维服务']
  },
};

export default function GamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">加载中...</div>}>
      <GameInner />
    </Suspense>
  );
}

function GameInner() {
  const params = useSearchParams();
  const router = useRouter();
  const location = params.get('location') || 'project-1';
  const scene = SCENE_INFO[location] || SCENE_INFO['project-1'];

  const [showIntro, setShowIntro] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [gameSessionId, setGameSessionId] = useState('');
  const [gameState, setGameState] = useState<GameRuntimeState | null>(null);
  const [input, setInput] = useState('');
  const [aiPracticeInput, setAiPracticeInput] = useState('');
  const [showAiPracticeModal, setShowAiPracticeModal] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [competitor, setCompetitor] = useState({ name: '华宇科技', bid: 540, trust: 42 });
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(true);
  const [npcs, setNpcs] = useState<NpcProfile[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);
  const [hoveredNpc, setHoveredNpc] = useState<number | null>(null);
  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  const [npcEmotion, setNpcEmotion] = useState<'greeting' | 'thinking' | 'excited' | 'annoyed'>('greeting');
  const [showNpcImage, setShowNpcImage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const round = gameState?.currentRound ?? 1;
  const score = gameState ? calculateTotalScore(gameState.dimensions) : 50;
  const coins = gameState?.actionPoints ?? 0;
  const intimacy = selectedNpc ? (gameState?.npcAffinity[selectedNpc] ?? 35) : 35;

  // 语音输入
  const toggleRecording = (target: 'input' | 'aiPractice') => {
    if (typeof window === 'undefined') return;
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别，请使用 Chrome 浏览器');
      return;
    }

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionResultEventLike) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (target === 'input') {
        setInput(transcript);
      } else {
        setAiPracticeInput(transcript);
      }
    };

    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const emotionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 情绪超时回退到寒暄
  useEffect(() => {
    if (npcEmotion !== 'greeting') {
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
      emotionTimerRef.current = setTimeout(() => setNpcEmotion('greeting'), 10000);
    }
    return () => { if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current); };
  }, [npcEmotion]);

  useEffect(() => {
    let cancelled = false;
    const projectId = location.replace('project-', '');
    const token = localStorage.getItem('coze_session') || '';
    const headers = { 'Content-Type': 'application/json', 'x-session': token };
    const sessionStorageKey = `game-session:${location}`;

    const bootstrap = async () => {
      let id = localStorage.getItem(sessionStorageKey) || '';
      let restored: { id: string; state: GameRuntimeState } | null = null;

      if (id) {
        const response = await fetch(`/api/game/sessions/${id}`, { headers });
        if (response.ok) {
          const data = await response.json();
          restored = data.gameSession;
        } else {
          localStorage.removeItem(sessionStorageKey);
          id = '';
        }
      }

      if (!id) {
        const response = await fetch('/api/game/sessions', {
          method: 'POST',
          headers,
          body: JSON.stringify({ scenarioCode: location }),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          throw new Error(error?.error || '对局创建失败');
        }
        const data = await response.json();
        restored = data.gameSession;
        id = restored?.id || '';
        localStorage.setItem(sessionStorageKey, id);
      }

      if (!restored || cancelled) return;
      setGameSessionId(restored.id);
      setGameState(restored.state);

      const npcResponse = await fetch(
        `/api/game-data/npcs?project_id=${projectId}&game_session_id=${restored.id}`,
        { headers },
      );
      if (!npcResponse.ok) throw new Error('NPC加载失败');
      const npcData = await npcResponse.json();
      const loadedNpcs: NpcProfile[] = Array.isArray(npcData.data) ? npcData.data : [];
      if (cancelled) return;
      setNpcs(loadedNpcs);
      setSelectedNpc((current) =>
        current && loadedNpcs.some((npc) => npc.id === current) ? current : (loadedNpcs[0]?.id ?? null)
      );
    };

    bootstrap().catch((error) => {
      if (!cancelled) alert(error instanceof Error ? error.message : '对局初始化失败');
    });

    setLoadingCompetitors(true);
    fetch(`/api/game-data/competitors?project_id=${projectId}`)
      .then(r => r.json())
      .then(d => {
        const data: CompetitorProfile[] = Array.isArray(d.data) ? d.data : [];
        setCompetitors(data);
        setLoadingCompetitors(false);
      })
      .catch(err => {
        console.error('Failed to load competitors:', err);
        setLoadingCompetitors(false);
      });
    return () => { cancelled = true; };
  }, [location]);

  useEffect(() => {
    if (!gameSessionId || !selectedNpc) return;
    const token = localStorage.getItem('coze_session') || '';
    fetch(`/api/game/sessions/${gameSessionId}/messages?npcId=${encodeURIComponent(selectedNpc)}`, {
      headers: { 'x-session': token },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('对话历史加载失败');
        return response.json();
      })
      .then((data) => {
        const restoredMessages: Message[] = (data.messages || []).map((message: { role: Message['role']; content: string; createdAt: string }) => ({
          role: message.role,
          content: message.content,
          ts: new Date(message.createdAt).getTime(),
        }));
        setMessages(restoredMessages.length > 0 ? restoredMessages : [{
          role: 'assistant',
          content: scene.description || `欢迎来到 ${scene.name}。项目预算 ¥${scene.budget}万。`,
          ts: Date.now(),
        }]);
      })
      .catch((error) => console.error(error));
  }, [gameSessionId, selectedNpc, scene]);

  useEffect(() => {
    if (!gameSessionId || !gameState) return;
    const projectId = location.replace('project-', '');
    fetch(`/api/game-data/npcs?project_id=${projectId}&game_session_id=${gameSessionId}`, {
      headers: { 'x-session': localStorage.getItem('coze_session') || '' },
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('NPC状态刷新失败')))
      .then((data) => setNpcs(Array.isArray(data.data) ? data.data : []))
      .catch((error) => console.error(error));
  }, [gameSessionId, gameState?.version, location]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || streaming) return;
    if (!selectedNpc || !gameSessionId) {
      alert('对局或NPC尚未加载完成，请稍后重试');
      return;
    }
    const userMsg: Message = { role: 'user', content, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setStreaming(true);

    // 准备 assistant 占位
    const assistantMsg: Message = { role: 'assistant', content: '', ts: Date.now() };
    setMessages((m) => [...m, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session': localStorage.getItem('coze_session') || '',
        },
        body: JSON.stringify({
          gameSessionId,
          scenarioId: location,
          npcId: selectedNpc,
          message: userMsg.content,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error('流式响应失败');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 数据
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              setStreaming(false);
              return;
            }
            try {
              const json = JSON.parse(data);
              if (json.content) {
                accumulated += json.content;
                setMessages((m) =>
                  m.map((msg, i) =>
                    i === m.length - 1 && msg.role === 'assistant'
                      ? { ...msg, content: accumulated }
                      : msg
                  )
                );
              }
              if (json.type === 'result' && json.state) {
                setGameState(json.state);
                setNpcEmotion(json.emotion || 'thinking');
              }
              if (json.type === 'error') {
                console.warn(json.code, json.error);
                if (!accumulated && json.error) {
                  setMessages((current) =>
                    current.map((message, index) =>
                      index === current.length - 1 && message.role === 'assistant'
                        ? { ...message, content: `（${json.error}）` }
                        : message
                    )
                  );
                }
              }
            } catch {
              // 忽略
            }
          }
        }
      }
      setStreaming(false);
    } catch (err) {
      console.error(err);
      setMessages((m) =>
        m.map((msg, i) =>
          i === m.length - 1 && msg.role === 'assistant'
            ? { ...msg, content: '（连接中断，请重试）' }
            : msg
        )
      );
      setStreaming(false);
    }
  };

  const executeAction = async (action: typeof ACTIONS[0]) => {
    if (!gameSessionId || !selectedNpc || streaming) return;
    const response = await fetch(`/api/game/sessions/${gameSessionId}/actions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session': localStorage.getItem('coze_session') || '',
      },
      body: JSON.stringify({ npcId: selectedNpc, actionId: action.id }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      alert(data?.error === 'ACTION_POINTS_INSUFFICIENT' ? '操作点数不足' : '关系动作执行失败');
      return;
    }
    setGameState(data.state);
    await sendMessage(`[${action.name}] 我方希望通过这次安排进一步交流合作。`);
  };

  const advanceGame = async () => {
    if (!gameSessionId || streaming) return;
    const response = await fetch(`/api/game/sessions/${gameSessionId}/advance`, {
      method: 'POST',
      headers: { 'x-session': localStorage.getItem('coze_session') || '' },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      alert(data?.error || '轮次推进失败');
      return;
    }
    setGameState(data.state);
    if (data.state.status !== 'playing') {
      router.push(`/result?sessionId=${gameSessionId}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F6F8FB' }}>
{/* 顶部状态栏 */}
      <header className="h-14 bg-card border-b border-border px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">{scene.name}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">第 {round} / {gameState?.maxRounds ?? 5} 轮</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-warning/10 text-warning">难度 ★ {scene.difficulty}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs">
            <Trophy className="w-3.5 h-3.5 text-primary" />
            <span className="text-foreground font-semibold">{score}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Target className="w-3.5 h-3.5 text-success" />
            <span className="text-foreground font-semibold">{intimacy}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-warning" />
            <span className="text-foreground font-semibold">{coins}</span>
          </div>
          <button
            onClick={advanceGame}
            className="ml-2 px-3 py-1.5 rounded bg-error text-white text-xs font-semibold hover:bg-error/90"
          >
            {round >= (gameState?.maxRounds ?? 5) ? '完成对局' : '结束本轮'}
          </button>
        </div>
      </header>

      {/* 三栏布局 */}
      <div className="flex-1 grid grid-cols-[320px_1fr_320px] overflow-hidden">
        {/* 左栏：项目场景 */}
        <aside className="bg-card border-r border-border overflow-y-auto p-4 space-y-4">
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="text-[10px] text-muted-foreground mb-1">甲方</div>
            <div className="text-sm font-semibold text-foreground">{scene.name}</div>
            <div className="text-[11px] text-muted-foreground mt-1">预算 ¥{scene.budget}万</div>
          </div>

          <div>
            <div className="text-xs font-semibold text-foreground mb-2">核心目标</div>
            <div className="space-y-1.5">
              {(scene.requirements || ['了解项目背景', '攻关决策人', '击败竞品', '中标成交']).map((n, i) => (
                <div key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary mt-1.5" /> {n}
                </div>
              ))}
            </div>
          </div>

          {/* 关键人物结构图 - 金字塔型 */}
          <div>
            <div className="text-xs font-semibold text-foreground mb-3">关键人物结构图</div>
            <div className="relative">
              {/* 金字塔层级 */}
              {['高层', '中层', '一线'].map((category, levelIdx) => {
                const categoryNpcs = npcs.filter(n => n.category === category);
                if (categoryNpcs.length === 0) return null;
                return (
                  <div key={category} className="mb-4">
                    {/* 层级标签 */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        levelIdx === 0 ? 'bg-error text-white' :
                        levelIdx === 1 ? 'bg-warning text-white' :
                        'bg-primary text-white'
                      }`}>{levelIdx + 1}</div>
                      <div className="text-[10px] font-semibold text-muted-foreground">{category}</div>
                    </div>
                    
                    {/* 人物卡片 */}
                    <div className="flex flex-wrap gap-2 justify-center">
                      {categoryNpcs.map(npc => (
                        <div
                          key={npc.id}
                          className={`relative group cursor-pointer transition-all ${
                            selectedNpc === npc.id ? 'scale-105' : 'hover:scale-105'
                          }`}
                          onClick={() => setSelectedNpc(npc.id)}
                        >
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                            selectedNpc === npc.id 
                              ? 'border-primary bg-primary/10 text-primary' 
                              : levelIdx === 0 ? 'border-error/50 bg-error/5 text-error' :
                                levelIdx === 1 ? 'border-warning/50 bg-warning/5 text-warning' :
                                'border-primary/50 bg-primary/5 text-primary'
                          }`}>
                            {npc.name[0] || npc.title[0]}
                          </div>
                          <div className="text-[9px] text-center mt-1 text-foreground font-medium truncate w-14">
                            {npc.name || npc.title}
                          </div>
                          
                          {/* 悬停显示详细信息 */}
                          <div className="absolute left-full top-0 ml-2 z-50 w-56 p-3 rounded-lg bg-card border border-border shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                            <div className="text-xs font-bold text-foreground mb-2">{npc.name || npc.title}</div>
                            <div className="space-y-1 text-[10px]">
                              <div className="flex justify-between"><span className="text-muted-foreground">职务</span><span className="text-foreground">{npc.title}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">性别</span><span className="text-foreground">{npc.gender}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">年龄</span><span className="text-foreground">{npc.age}岁</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">籍贯</span><span className="text-foreground">{npc.hometown}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">性格</span><span className="text-foreground">{npc.personality}</span></div>
                              <div className="mt-2 pt-2 border-t border-border">
                                <div className="text-muted-foreground mb-1">软肋</div>
                                <div className="text-foreground text-[9px] leading-relaxed">{npc.weakness || '尚未解锁'}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* 连接线 */}
                    {levelIdx < 2 && npcs.filter(n => ['高层', '中层', '一线'][levelIdx + 1] && npcs.filter(nn => nn.category === ['高层', '中层', '一线'][levelIdx + 1]).length > 0).length > 0 && (
                      <div className="flex justify-center my-2">
                        <div className="w-px h-4 bg-border" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* 中栏：AI 对话 */}
        <main className="flex flex-col bg-background">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {showIntro && !showAiPracticeModal ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="relative max-w-lg w-full">
                  {/* 气泡框 - 项目介绍 */}
                  <div className="bg-card rounded-2xl shadow-lg p-6 mb-4 border border-border">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 text-sm text-foreground leading-relaxed space-y-2">
                        <p className="font-semibold text-base">{scene.name}</p>
                        <p className="text-muted-foreground">{scene.description}</p>
                        <div className="flex gap-4 pt-2 border-t border-border/50">
                          <div>
                            <span className="text-[10px] text-muted-foreground">项目预算</span>
                            <div className="text-sm font-semibold text-primary">¥{scene.budget}万</div>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">核心决策人</span>
                            <div className="text-sm font-semibold text-foreground">{scene.leader}</div>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground">难度</span>
                            <div className="text-sm font-semibold text-warning">{'★'.repeat(scene.difficulty)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* 大楼图片（可点击） */}
                  <button
                    onClick={() => { setShowIntro(false); setShowNpcImage(true); }}
                    className="w-full group relative"
                  >
                    <img src="/building.png" alt="项目大楼" className="w-full h-auto rounded-xl shadow-lg group-hover:shadow-xl transition-shadow" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-4 py-2 rounded-lg text-sm font-semibold text-foreground shadow">
                        点击进入攻略
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border text-foreground'
                      }`}
                    >
                      {msg.content || (streaming && i === messages.length - 1 ? '...' : '')}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />

                {/* 被攻略人情绪头像 */}
                {showNpcImage && (
                <div className="pt-2">
                  <img
                    src={`/emotion-${npcEmotion}.jpeg`}
                    alt="NPC情绪"
                    className="w-1/3 rounded-2xl object-cover shadow-lg border-2 border-white/80 transition-all duration-500"
                  />
                </div>
                )}

                {/* 操作按钮区 - 两排 */}
                <div className="pt-3 border-t border-border w-1/3">
                  <div className="text-[10px] text-muted-foreground mb-2">关系经营（消耗操作点）</div>
                  <div className="grid grid-cols-4 gap-2">
                    {ACTIONS.map((a) => {
                      const Icon = a.icon;
                      return (
                        <button
                          key={a.id}
                          onClick={() => executeAction(a)}
                          disabled={streaming || coins < a.cost}
                          className="flex flex-col items-center gap-1 p-2 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition disabled:opacity-50"
                        >
                          <Icon className="w-4 h-4 text-primary" />
                          <span className="text-[10px] font-semibold text-foreground">{a.name}</span>
                          <span className="text-[9px] text-muted-foreground">{a.cost}点</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 底部区域 */}
          {showAiPracticeModal ? (
              /* AI 实战对练 - 全宽对话模式 */
              <div className="rounded-xl border-2 p-4 flex flex-col gap-3" style={{ borderColor: '#EAB308', background: '#FFFBEB' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#EAB308' }}>
                      <Target className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-bold" style={{ color: '#92400E' }}>AI 实战对练</span>
                  </div>
                </div>
                {/* 输入区 - 紧跟标题下方 */}
                <div className="flex gap-2 items-end">
                  <textarea
                    value={aiPracticeInput}
                    onChange={(e) => setAiPracticeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (aiPracticeInput.trim() && !streaming) {
                          sendMessage(aiPracticeInput);
                          setAiPracticeInput('');
                        }
                      }
                    }}
                    placeholder="输入你的话术..."
                    disabled={streaming}
                    rows={2}
                    className="flex-1 px-3 py-2 rounded-lg border text-xs resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    style={{ borderColor: '#EAB308', background: '#FFFFFF', color: '#92400E' }}
                  />
                  <button
                    onClick={() => toggleRecording('aiPractice')}
                    className="p-2 rounded-lg border text-xs shrink-0 transition-colors"
                    style={{ borderColor: isRecording ? '#EF4444' : '#EAB308', background: isRecording ? '#FEE2E2' : '#FFFFFF', color: isRecording ? '#EF4444' : '#92400E' }}
                    title={isRecording ? '停止录音' : '语音输入'}
                  >
                    {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => {
                      if (aiPracticeInput.trim() && !streaming) {
                        sendMessage(aiPracticeInput);
                        setAiPracticeInput('');
                      }
                    }}
                    disabled={streaming || !aiPracticeInput.trim()}
                    className="px-4 py-2 rounded-lg text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    style={{ background: '#EAB308' }}
                  >
                    <Send className="w-3.5 h-3.5" /> 发送
                  </button>
                </div>

              </div>
            ) : (
              /* 默认：双输入框布局 7:3 */
              <div className="grid gap-4" style={{ gridTemplateColumns: '7fr 3fr' }}>
                {/* 左侧：攻坚策略概述 */}
                <div className="flex flex-col gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="输入你的完整攻坚策略和行动计划..."
                    disabled={streaming}
                    rows={3}
                    className="flex-1 px-3 py-2 rounded-lg bg-surface-container border-none text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleRecording('input')}
                      className="px-3 py-2 rounded-lg border text-sm transition-colors"
                      style={{ borderColor: isRecording ? '#EF4444' : '#E5E7EB', background: isRecording ? '#FEE2E2' : '#FFFFFF', color: isRecording ? '#EF4444' : '#637089' }}
                      title={isRecording ? '停止录音' : '语音输入'}
                    >
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => sendMessage(input)}
                      disabled={streaming || !input.trim()}
                      className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> 发送
                    </button>
                  </div>
                </div>

                {/* 右侧：AI 实战对练 - 大黄框 */}
                <button
                  onClick={() => setShowAiPracticeModal(true)}
                  className="flex-1 rounded-xl border-2 flex flex-col items-center justify-center gap-3 transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer"
                  style={{ borderColor: '#EAB308', background: 'linear-gradient(135deg, #FEF9C3 0%, #FDE68A 100%)' }}
                >
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: '#EAB308' }}>
                    <Target className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-base font-bold" style={{ color: '#92400E' }}>AI 实战对练</div>
                  <div className="text-xs" style={{ color: '#A16207' }}>点击开启与 AI 甲方多轮对话演练</div>
                </button>
              </div>
            )}
        </main>

        {/* 右栏：实时博弈看板 */}
        <aside className="bg-card border-l border-border overflow-y-auto p-4 space-y-4">
          <div>
            <div className="text-xs font-semibold text-foreground mb-3">实时博弈看板</div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">综合得分</span>
                  <span className="font-semibold text-foreground">{score} / 100</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${score}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">客户亲密度</span>
                  <span className="font-semibold text-foreground">{intimacy} / 100</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                  <div className="h-full bg-success transition-all" style={{ width: `${intimacy}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">技术匹配</span>
                  <span className="font-semibold text-foreground">72%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                  <div className="h-full bg-warning transition-all" style={{ width: '72%' }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground">价格竞争力</span>
                  <span className="font-semibold text-foreground">65%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                  <div className="h-full bg-error transition-all" style={{ width: '65%' }} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-foreground mb-2">竞品动态</div>
            <div className="p-3 rounded-lg border border-border">
              <button
                onClick={() => setShowCompetitorModal(true)}
                className="w-full px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                查看{competitors.length === 3 ? 'ABC' : 'ABCD'}公司特点表
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-foreground mb-2">下一步建议</div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-foreground">
              建议强调国产化适配经验，匹配张副市长的技术驱动偏好。
            </div>
          </div>
        </aside>
      </div>

      {/* 竞品公司特点表弹窗 */}
      {showCompetitorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCompetitorModal(false)}>
          <div className="bg-card rounded-2xl shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{competitors.length === 3 ? 'ABC' : 'ABCD'}公司特点表</h2>
                  <p className="text-xs text-muted-foreground">竞品公司信息对比</p>
                </div>
              </div>
              <button onClick={() => setShowCompetitorModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {loadingCompetitors ? (
                <div className="text-center py-12 text-sm text-muted-foreground">加载中...</div>
              ) : competitors.length > 0 ? (
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-surface-container border-b border-border">
                        <th className="px-4 py-3 text-left font-semibold text-foreground">项目</th>
                        {competitors.map((cp, i) => (
                          <th key={i} className="px-4 py-3 text-center font-bold text-primary">{cp.company_name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border">
                        <td className="px-4 py-3 font-semibold text-foreground">公司特点</td>
                        {competitors.map((cp, i) => (
                          <td key={i} className="px-4 py-3 text-center text-foreground/80">{cp.features}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-semibold text-foreground align-top">更多信息</td>
                        {competitors.map((cp, i) => (
                          <td key={i} className="px-4 py-3 text-center text-muted-foreground align-top">{cp.more_info || '-'}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">暂无竞品数据</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
