'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  Gift,
  Inbox,
  ListTodo,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  MicOff,
  MoreHorizontal,
  PackageCheck,
  Phone,
  Play,
  Send,
  Sparkles,
  UserRound,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { getPhaseName, type GameRuntimeState } from '@/lib/game/state';
import { getProjectOneNpc } from '@/lib/game/project-one';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: number;
  deliveryStatus?: 'sent' | 'replied' | 'unanswered';
  channel?: 'email' | 'work_phone' | 'online' | 'offline';
}

interface CompetitorProfile {
  company_name: string;
  features: string;
  more_info: string;
}

interface NpcProfile {
  id: string;
  category: string;
  name: string;
  title: string;
  gender: string;
  age: number | null;
  hometown: string;
  personality: string;
  weakness: string | null;
}

interface AppointmentView {
  id: string;
  npcId: string;
  visitType: 'short' | 'formal' | 'informal';
  approach: 'dedicated' | 'drop_by';
  status: string;
  location: string;
  purpose: string;
  stage: number;
  scheduledMinute: number;
  scheduledLabel?: string;
  durationMinutes: number;
  conditions: string[];
}

interface PreparationView {
  id: string;
  npcId: string;
  appointmentId?: string;
  type: string;
  title: string;
  status: string;
  cost: number;
  minutes: number;
}

interface NotificationView {
  id: string;
  npcId?: string;
  title: string;
  body: string;
  read: boolean;
  createdLabel?: string;
  target?: string;
}

interface MeetingMinutesView {
  id: string;
  appointmentId: string;
  npcId: string;
  visitType: 'short' | 'formal' | 'informal';
  summary: string;
  confirmedItems: string[];
  npcCommitments: string[];
  playerCommitments: string[];
  pendingMaterials: string[];
  nextStep: string;
  nextStepRound: number;
  nextStepMinute: number;
  owner: string;
}

interface ActiveMeetingView {
  id: string;
  npcId: string;
  appointmentId?: string;
  visitType: 'short' | 'formal' | 'informal';
  turnCount: number;
  maxTurns: number;
  durationMinutes: number;
  workTopicOpenedBy?: string;
  usedPreparationIds: string[];
}

interface GameSaveView {
  id: string;
  scenarioCode: string;
  currentRound: number;
  maxRounds: number;
  updatedAt: string;
  startedAt: string;
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
type PhoneTab = 'contacts' | 'messages' | 'tasks';
type WorkspaceMode = 'conversation' | 'appointment' | 'preparation' | 'follow_up';
type CommunicationChannel = 'email' | 'online' | 'work_phone';

const CHANNEL_META: Record<CommunicationChannel, { label: string; hint: string; accent: string }> = {
  email: { label: '邮件', hint: '正式邮件 · 消耗 10 分钟', accent: 'text-blue-700 bg-blue-50 border-blue-200' },
  online: { label: '微信', hint: '即时消息 · 消耗 5 分钟', accent: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  work_phone: { label: '电话', hint: '工作电话 · 消耗 15 分钟', accent: 'text-violet-700 bg-violet-50 border-violet-200' },
};

const SCENE_INFO: Record<string, { name: string; budget: number; difficulty: number; description: string }> = {
  'project-1': {
    name: '项目一 · 单单位内部竞标',
    budget: 100,
    difficulty: 1,
    description: '围绕客户的真实组织需求建立联系、摸清决策链，并用可靠方案推动项目。过程指标全部隐藏，请根据人物的语言和行动判断局势。',
  },
  'project-2': { name: '项目二 · 国产化改造项目', budget: 300, difficulty: 2, description: '协调甲方与设计院，推动复杂技术改造项目。' },
  'project-3': { name: '项目三 · 大型央企升级项目', budget: 1000, difficulty: 3, description: '识别多部门制衡关系，建立可靠的高层沟通路径。' },
  'project-4': { name: '项目四 · 一体化总包解决方案', budget: 200, difficulty: 4, description: '重塑客户价值，寻找超越单品低价竞争的突破口。' },
};

const VISIT_LABELS = { short: '短时拜访', formal: '正式拜访', informal: '非正式拜访' } as const;
const VISIT_DURATIONS = { short: 5, formal: 40, informal: 60 } as const;
const VISIT_MAX_TURNS = { short: 2, formal: 6, informal: 5 } as const;
const STATUS_LABELS: Record<string, string> = {
  pending: '待回复',
  accepted: '已接受',
  countered: 'NPC改期',
  rejected: '已拒绝',
  cancelled: '已取消',
  missed: '已爽约',
  active: '进行中',
  completed: '已完成',
};
const PREPARATION_OPTIONS = [
  { type: 'agenda', title: '明确拜访议程', minutes: 10, cost: 1, description: '让正式会谈更聚焦' },
  { type: 'ppt', title: '制作方案 PPT', minutes: 30, cost: 4, description: '用于正式方案陈述' },
  { type: 'materials', title: '准备案例 / 技术 / 报价材料', minutes: 15, cost: 2, description: '根据人物职责判断相关性' },
  { type: 'courtesy_gift', title: '准备合规伴手礼', minutes: 10, cost: 3, description: '低风险、收益较稳定' },
  { type: 'boundary_gift', title: '准备高波动边界礼品', minutes: 10, cost: 8, description: '潜在收益更高，也可能拒收、上报或延迟反噬' },
] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function firstRecord(source: Record<string, unknown> | null, keys: string[]): Record<string, unknown> | null {
  if (!source) return null;
  for (const key of keys) {
    const result = asRecord(source[key]);
    if (result) return result;
  }
  return null;
}

function firstArray(source: Record<string, unknown> | null, keys: string[]): unknown[] {
  if (!source) return [];
  for (const key of keys) {
    if (Array.isArray(source[key])) return source[key] as unknown[];
  }
  return [];
}

function firstString(source: Record<string, unknown> | null, keys: string[], fallback = ''): string {
  if (!source) return fallback;
  for (const key of keys) {
    if (typeof source[key] === 'string') return source[key] as string;
  }
  return fallback;
}

function firstNumber(source: Record<string, unknown> | null, keys: string[], fallback = 0): number {
  if (!source) return fallback;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return fallback;
}

function parseMinuteLabel(label: string, fallback = 540): number {
  const matched = /^(\d{1,2}):(\d{2})$/.exec(label);
  return matched ? Number(matched[1]) * 60 + Number(matched[2]) : fallback;
}

function formatClock(totalMinutes: number): string {
  const normalized = Math.max(0, Math.round(totalMinutes));
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  if (hours === 0) return `${remainder}分钟`;
  if (remainder === 0) return `${hours}小时`;
  return `${hours}小时${remainder}分`;
}

function formatMessageTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(timestamp));
}

function simulationRecord(state: GameRuntimeState | null): Record<string, unknown> | null {
  const root = asRecord(state);
  return firstRecord(root, ['simulation', 'simulationState', 'simulationTime', 'schedule']) ?? root;
}

function getSimulationSummary(state: GameRuntimeState | null) {
  const root = asRecord(state);
  const simulation = simulationRecord(state);
  const reserved = firstNumber(simulation, ['reservedMinutes', 'scheduledMinutes', 'appointmentMinutes'], 0);
  const elapsed = firstNumber(simulation, ['elapsedMinutes', 'phaseElapsedMinutes', 'investedMinutes', 'usedMinutes'], 0);
  const explicitClock = firstNumber(simulation, ['simulatedClockMinutes', 'minuteOfDay', 'clockMinute', 'currentMinuteOfDay'], -1);
  const label = firstString(simulation, ['clock', 'currentTime', 'timeLabel']);
  const minuteOfDay = explicitClock >= 0 ? explicitClock : label ? parseMinuteLabel(label, 540 + elapsed) : 540 + elapsed;
  const available = firstNumber(simulation, ['dayAvailableMinutes', 'availableMinutes', 'remainingMinutes', 'remainingWorkMinutes'], Math.max(0, 480 - elapsed - reserved));
  return {
    minuteOfDay,
    available,
    elapsed,
    reserved,
    totalMinutes: firstNumber(simulation, ['cumulativeTimeMinutes', 'totalInvestedMinutes', 'cumulativeMinutes', 'totalElapsedMinutes'], elapsed),
    totalSpent: firstNumber(simulation, ['cumulativeSpentPoints', 'totalActionPointsSpent', 'cumulativeActionPointsSpent', 'spentActionPoints'], firstNumber(root, ['cumulativeSpentPoints', 'totalActionPointsSpent'], 0)),
  };
}

function getAppointments(state: GameRuntimeState | null): AppointmentView[] {
  const root = asRecord(state);
  const simulation = simulationRecord(state);
  const raw = firstArray(simulation, ['appointments', 'visits', 'calendar']) .length > 0
    ? firstArray(simulation, ['appointments', 'visits', 'calendar'])
    : firstArray(root, ['appointments', 'visits']);
  return raw.map((value, index) => {
    const item = asRecord(value);
    const rawType = firstString(item, ['visitType', 'type', 'meetingType'], 'formal');
    const visitType: AppointmentView['visitType'] = rawType === 'short' || rawType === 'informal' ? rawType : 'formal';
    const scheduledLabel = firstString(item, ['scheduledTime', 'timeLabel', 'time']);
    return {
      id: firstString(item, ['id', 'appointmentId'], `appointment-${index}`),
      npcId: firstString(item, ['npcId', 'contactId']),
      visitType,
      approach: ['drop_by', 'drop_in'].includes(firstString(item, ['approach', 'invitationMethod', 'travelMode', 'invitationMode'])) ? 'drop_by' : 'dedicated',
      status: firstString(item, ['status'], 'pending'),
      location: firstString(item, ['location', 'venue'], visitType === 'formal' ? '办公室' : '咖啡厅'),
      purpose: firstString(item, ['purpose', 'objective'], '进一步沟通'),
      stage: firstNumber(item, ['scheduledRound', 'stage', 'phase', 'round'], state?.currentRound ?? 1),
      scheduledMinute: firstNumber(item, ['startMinute', 'scheduledMinute', 'minuteOfDay'], scheduledLabel ? parseMinuteLabel(scheduledLabel) : 840),
      scheduledLabel: scheduledLabel || undefined,
      durationMinutes: firstNumber(item, ['durationMinutes', 'duration'], VISIT_DURATIONS[visitType]),
      conditions: firstArray(item, ['conditions', 'requirements']).filter((entry): entry is string => typeof entry === 'string'),
    };
  });
}

function getPreparations(state: GameRuntimeState | null): PreparationView[] {
  const root = asRecord(state);
  const simulation = simulationRecord(state);
  const nested = firstArray(simulation, ['preparations', 'materials', 'inventory']);
  const raw = nested.length > 0 ? nested : firstArray(root, ['preparations', 'materials', 'inventory']);
  return raw.map((value, index) => {
    const item = asRecord(value);
    const type = firstString(item, ['type', 'preparationType', 'kind'], 'materials');
    const option = PREPARATION_OPTIONS.find((entry) => entry.type === type);
    return {
      id: firstString(item, ['id', 'preparationId'], `preparation-${index}`),
      npcId: firstString(item, ['npcId', 'contactId']),
      appointmentId: firstString(item, ['appointmentId']) || undefined,
      type,
      title: firstString(item, ['title', 'name'], option?.title ?? '拜访材料'),
      status: firstString(item, ['status'], 'ready'),
      cost: firstNumber(item, ['costPoints', 'cost', 'actionPointCost'], option?.cost ?? 0),
      minutes: firstNumber(item, ['timeMinutes', 'minutes', 'durationMinutes'], option?.minutes ?? 0),
    };
  });
}

function getNotifications(state: GameRuntimeState | null): NotificationView[] {
  const root = asRecord(state);
  const simulation = simulationRecord(state);
  const nested = firstArray(simulation, ['notifications', 'inbox', 'messages']);
  const raw = nested.length > 0 ? nested : firstArray(root, ['notifications', 'inbox']);
  return raw.map((value, index) => {
    const item = asRecord(value);
    const readAt = firstString(item, ['readAt']);
    const notificationRound = firstNumber(item, ['round', 'stage'], 0);
    const notificationMinute = firstNumber(item, ['minute', 'minuteOfDay'], -1);
    const explicitLabel = firstString(item, ['createdLabel', 'timeLabel', 'createdAt']);
    return {
      id: firstString(item, ['id', 'notificationId'], `notification-${index}`),
      npcId: firstString(item, ['npcId', 'contactId']) || undefined,
      title: firstString(item, ['title', 'subject'], '新消息'),
      body: firstString(item, ['body', 'content', 'message'], '你收到一条新的项目消息。'),
      read: typeof item?.isRead === 'boolean' ? item.isRead : typeof item?.read === 'boolean' ? item.read : Boolean(readAt),
      createdLabel: explicitLabel || (notificationRound > 0 && notificationMinute >= 0 ? `第${notificationRound}阶段 · ${formatClock(notificationMinute)}` : undefined),
      target: firstString(item, ['targetId', 'target', 'entry']) || undefined,
    };
  });
}

function getMeetingMinutes(state: GameRuntimeState | null): MeetingMinutesView[] {
  const root = asRecord(state);
  const simulation = simulationRecord(state);
  const nested = firstArray(simulation, ['meetingMinutes', 'visitMinutes']);
  const raw = nested.length > 0 ? nested : firstArray(root, ['meetingMinutes', 'visitMinutes']);
  return raw.map((value, index) => {
    const item = asRecord(value);
    const rawType = firstString(item, ['visitType', 'meetingType'], 'formal');
    const visitType: MeetingMinutesView['visitType'] = rawType === 'short' || rawType === 'informal' ? rawType : 'formal';
    const stringItems = (keys: string[]) => firstArray(item, keys).filter((entry): entry is string => typeof entry === 'string');
    return {
      id: firstString(item, ['id', 'minutesId'], `meeting-minutes-${index}`),
      appointmentId: firstString(item, ['appointmentId']),
      npcId: firstString(item, ['npcId', 'contactId']),
      visitType,
      summary: firstString(item, ['summary'], '本次拜访已完成。'),
      confirmedItems: stringItems(['confirmedItems', 'confirmedFacts']),
      npcCommitments: stringItems(['npcCommitments', 'customerCommitments']),
      playerCommitments: stringItems(['playerCommitments', 'ourCommitments']),
      pendingMaterials: stringItems(['pendingMaterials', 'materialsToSend']),
      nextStep: firstString(item, ['nextStep'], '确认纪要并安排后续沟通'),
      nextStepRound: firstNumber(item, ['nextStepRound', 'nextRound'], state?.currentRound ?? 1),
      nextStepMinute: firstNumber(item, ['nextStepMinute', 'nextMinute'], 9 * 60),
      owner: firstString(item, ['owner'], '我方销售 / 客户联系人'),
    };
  });
}

function getActiveMeeting(state: GameRuntimeState | null, appointments: AppointmentView[]): ActiveMeetingView | null {
  const root = asRecord(state);
  const raw = firstRecord(root, ['activeMeeting', 'meeting']);
  if (!raw) return null;
  const appointmentId = firstString(raw, ['appointmentId']);
  const appointment = appointments.find((item) => item.id === appointmentId);
  const actionId = firstString(raw, ['actionId']);
  const legacyType = actionId === 'dinner' || actionId === 'tea' ? 'informal' : actionId ? 'formal' : undefined;
  const rawType = firstString(raw, ['visitType', 'type', 'meetingType'], appointment?.visitType ?? legacyType ?? 'formal');
  const visitType: ActiveMeetingView['visitType'] = rawType === 'short' || rawType === 'informal' ? rawType : 'formal';
  return {
    id: firstString(raw, ['id', 'meetingId'], 'active-meeting'),
    npcId: firstString(raw, ['npcId', 'contactId']),
    appointmentId: appointmentId || undefined,
    visitType,
    turnCount: firstNumber(raw, ['turnCount', 'currentTurn'], 0),
    maxTurns: firstNumber(raw, ['maxTurns'], VISIT_MAX_TURNS[visitType]),
    durationMinutes: firstNumber(raw, ['durationMinutes', 'duration'], VISIT_DURATIONS[visitType]),
    workTopicOpenedBy: firstString(raw, ['workTopicOpenedBy', 'topicOpenedBy']) || undefined,
    usedPreparationIds: firstArray(raw, ['usedPreparationIds']).filter((id): id is string => typeof id === 'string'),
  };
}

function makeCommandId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `command-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function commandResultMessage(type: string, value: unknown): string {
  const result = asRecord(value);
  if (typeof result?.message === 'string') return result.message;
  if (type === 'invite') {
    const appointment = firstRecord(result, ['appointment']);
    const status = firstString(appointment, ['status']);
    return status ? `邀约结果：${STATUS_LABELS[status] ?? status}` : '邀约已发送';
  }
  if (type === 'give_gift') {
    const disposition = firstString(result, ['disposition']);
    const labels: Record<string, string> = {
      delighted_acceptance: '对方愉快地收下了礼品。',
      cautious_acceptance: '对方谨慎收下了礼品，态度仍值得留意。',
      polite_decline: '对方婉拒了礼品。',
      firm_rejection: '对方明确拒绝了礼品。',
      reported: '对方拒绝并上报了本次送礼。',
    };
    return labels[disposition] ?? '礼品递交结果已记录';
  }
  if (type === 'prepare') return '准备工作已完成，材料已进入库存';
  if (type === 'start_visit') return '拜访已开始';
  if (type === 'end_visit') return '拜访已结束，已生成会后待办';
  if (type === 'follow_up') return '材料或跟进消息已送出';
  if (type === 'update_appointment') return '预约状态已更新';
  return '操作已完成';
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center text-slate-500">正在进入项目...</div>}>
      <GameInner />
    </Suspense>
  );
}

function GameInner() {
  const params = useSearchParams();
  const router = useRouter();
  const location = params.get('location') || 'project-1';
  const scene = SCENE_INFO[location] ?? SCENE_INFO['project-1'];
  const [messages, setMessages] = useState<Message[]>([]);
  const [gameSessionId, setGameSessionId] = useState('');
  const [gameState, setGameState] = useState<GameRuntimeState | null>(null);
  const [savePickerReady, setSavePickerReady] = useState(false);
  const [activeSaves, setActiveSaves] = useState<GameSaveView[]>([]);
  const [maxSaves, setMaxSaves] = useState(5);
  const [savePickerError, setSavePickerError] = useState('');
  const [loadingSave, setLoadingSave] = useState(false);
  const [npcs, setNpcs] = useState<NpcProfile[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);
  const [phoneTab, setPhoneTab] = useState<PhoneTab>('contacts');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('conversation');
  const [communicationChannel, setCommunicationChannel] = useState<CommunicationChannel>('online');
  const [phoneCallActive, setPhoneCallActive] = useState(false);
  const [actionNpcId, setActionNpcId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [commandBusy, setCommandBusy] = useState<string | null>(null);
  const [commandFeedback, setCommandFeedback] = useState('');
  const [showResourceDetails, setShowResourceDetails] = useState(false);
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [newlyUnlockedNpcId, setNewlyUnlockedNpcId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [inviteDraft, setInviteDraft] = useState({
    visitType: 'formal' as AppointmentView['visitType'],
    approach: 'dedicated' as AppointmentView['approach'],
    location: '办公室',
    purpose: '介绍项目方案并了解关键诉求',
    stage: 1,
    time: '14:00',
  });
  const [preparationType, setPreparationType] = useState<(typeof PREPARATION_OPTIONS)[number]['type']>('agenda');
  const [preparationAppointmentId, setPreparationAppointmentId] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const typewriterTimerRef = useRef<number | null>(null);
  const typewriterQueueRef = useRef<string[]>([]);
  const commandBusyRef = useRef(false);
  const retryCommandRef = useRef<{ signature: string; commandId: string } | null>(null);
  const retryChatRef = useRef<{ signature: string; commandId: string } | null>(null);

  const round = gameState?.currentRound ?? 1;
  const coins = gameState?.actionPoints ?? 0;
  const simulation = getSimulationSummary(gameState);
  const appointments = getAppointments(gameState);
  const preparations = getPreparations(gameState);
  const notifications = getNotifications(gameState);
  const meetingMinutes = getMeetingMinutes(gameState);
  const activeMeeting = getActiveMeeting(gameState, appointments);
  const visibleChannelMessages = messages.filter((message) => message.channel === (activeMeeting ? 'offline' : communicationChannel));
  const selectedProfile = npcs.find((npc) => npc.id === selectedNpc) ?? null;
  const selectedContact = selectedNpc ? gameState?.npcContacts?.[selectedNpc] : undefined;
  const canInviteSelected = Boolean(selectedContact?.hasReplied && selectedContact.status !== 'known');
  const unreadCount = notifications.filter((item) => !item.read).length;
  const todayReservedMinutes = appointments
    .filter((item) => item.stage === round && ['accepted', 'active'].includes(item.status))
    .reduce((sum, item) => sum + item.durationMinutes, 0);
  const todayInvestedMinutes = Math.max(0, 480 - simulation.available - todayReservedMinutes);
  const selectedAppointments = appointments.filter((item) => item.npcId === selectedNpc);
  const selectedPreparations = preparations.filter((item) => item.npcId === selectedNpc || (item.appointmentId && selectedAppointments.some((appointment) => appointment.id === item.appointmentId)));
  const selectedMinutes = meetingMinutes.filter((item) => item.npcId === selectedNpc);
  const latestSelectedMinutes = selectedMinutes[selectedMinutes.length - 1];
  const latestCompletedAppointment = latestSelectedMinutes
    ? selectedAppointments.find((item) => item.id === latestSelectedMinutes.appointmentId)
    : [...selectedAppointments].reverse().find((item) => item.status === 'completed');
  const nextAppointment = appointments
    .filter((item) => ['accepted', 'countered', 'pending'].includes(item.status))
    .sort((a, b) => a.stage - b.stage || a.scheduledMinute - b.scheduledMinute)[0];

  const showUnlockNoticeOnce = (sessionId: string, npcId: string) => {
    const key = `npc-unlock-notified:${sessionId}:${npcId}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
    setNewlyUnlockedNpcId(npcId);
  };

  const applyServerState = (nextState: GameRuntimeState) => {
    setGameState((previous) => {
      const newlyUnlocked = nextState.unlockedNpcIds?.find((id) => !previous?.unlockedNpcIds?.includes(id));
      if (newlyUnlocked && gameSessionId) showUnlockNoticeOnce(gameSessionId, newlyUnlocked);
      return nextState;
    });
  };

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('weixun_session') || '';
    const headers = { 'Content-Type': 'application/json', 'x-session': token };
    const storageKey = `game-session:${location}`;
    const projectId = location.replace('project-', '');

    const bootstrap = async () => {
      const saveResponse = await fetch(`/api/game/sessions?scenarioCode=${encodeURIComponent(location)}`, { headers });
      const saveData = await saveResponse.json().catch(() => null);
      if (!saveResponse.ok) throw new Error(saveData?.error || '存档列表加载失败');
      if (!cancelled) {
        setActiveSaves(Array.isArray(saveData?.saves) ? saveData.saves : []);
        setMaxSaves(Number(saveData?.maxSaves) || 5);
        setSavePickerReady(true);
      }
      return;
      let id = localStorage.getItem(storageKey) || '';
      let restored: { id: string; state: GameRuntimeState } | null = null;
      if (id) {
        const response = await fetch(`/api/game/sessions/${id}`, { headers });
        if (response.ok) restored = (await response.json()).gameSession;
        else {
          localStorage.removeItem(storageKey);
          id = '';
        }
      }
      if (!id) {
        const response = await fetch('/api/game/sessions', { method: 'POST', headers, body: JSON.stringify({ scenarioCode: location }) });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || '对局创建失败');
        restored = data.gameSession;
        id = restored?.id || '';
        localStorage.setItem(storageKey, id);
      }
      if (!restored || cancelled) return;
      setGameSessionId(restored!.id);
      setGameState(restored!.state);
      setInviteDraft((current) => ({ ...current, stage: restored?.state.currentRound ?? 1 }));
      const npcResponse = await fetch(`/api/game-data/npcs?project_id=${projectId}&game_session_id=${restored!.id}`, { headers });
      if (!npcResponse.ok) throw new Error('NPC加载失败');
      const npcData = await npcResponse.json();
      const loaded: NpcProfile[] = Array.isArray(npcData.data) ? npcData.data : [];
      if (cancelled) return;
      setNpcs(loaded);
      setSelectedNpc(restored!.state.activeMeeting?.npcId ?? loaded[0]?.id ?? null);
    };

    bootstrap().catch((error) => {
      if (!cancelled) alert(error instanceof Error ? error.message : '对局初始化失败');
    });
    fetch(`/api/game-data/competitors?project_id=${projectId}`)
      .then((response) => response.json())
      .then((data) => setCompetitors(Array.isArray(data.data) ? data.data : []))
      .catch(() => setCompetitors([]));
    return () => { cancelled = true; };
  }, [location]);

  useEffect(() => {
    if (!gameSessionId || !selectedNpc) return;
    fetch(`/api/game/sessions/${gameSessionId}/messages?npcId=${encodeURIComponent(selectedNpc)}`, {
      headers: { 'x-session': localStorage.getItem('weixun_session') || '' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('对话历史加载失败');
        return response.json();
      })
      .then((data) => {
        const restored: Message[] = (data.messages || []).map((message: { role: Message['role']; content: string; createdAt: string; metadata?: Record<string, unknown> }) => ({
          role: message.role,
          content: message.content,
          ts: new Date(message.createdAt).getTime(),
          deliveryStatus: message.metadata?.deliveryStatus as Message['deliveryStatus'],
          channel: message.metadata?.channel as Message['channel'],
        }));
        setMessages(restored);
      })
      .catch((error) => console.error(error));
  }, [gameSessionId, selectedNpc]);

  useEffect(() => {
    if (activeMeeting) return;
    const preferred = selectedContact?.status === 'online' ? 'online' : selectedContact?.initialChannel;
    if (preferred === 'email' || preferred === 'online' || preferred === 'work_phone') setCommunicationChannel(preferred);
  }, [activeMeeting, selectedContact?.initialChannel, selectedContact?.status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (typewriterTimerRef.current !== null) window.clearInterval(typewriterTimerRef.current);
    typewriterQueueRef.current = [];
  }, []);

  const openSave = async (sessionId: string) => {
    setLoadingSave(true);
    setSavePickerError('');
    try {
      const headers = { 'Content-Type': 'application/json', 'x-session': localStorage.getItem('weixun_session') || '' };
      const response = await fetch(`/api/game/sessions/${sessionId}`, { headers });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.gameSession) throw new Error(data?.error || '存档读取失败');
      const restored = data.gameSession as { id: string; state: GameRuntimeState };
      if (restored.state.status !== 'playing') throw new Error('该对局已结束，只能在历史对局中查看结果');
      const projectId = location.replace('project-', '');
      const npcResponse = await fetch(`/api/game-data/npcs?project_id=${projectId}&game_session_id=${restored.id}`, { headers });
      if (!npcResponse.ok) throw new Error('NPC 加载失败');
      const npcData = await npcResponse.json();
      const loaded: NpcProfile[] = Array.isArray(npcData.data) ? npcData.data : [];
      localStorage.setItem(`game-session:${location}`, restored.id);
      setGameSessionId(restored.id);
      setGameState(restored.state);
      setInviteDraft((current) => ({ ...current, stage: restored.state.currentRound }));
      setNpcs(loaded);
      setSelectedNpc(restored.state.activeMeeting?.npcId ?? loaded[0]?.id ?? null);
    } catch (error) {
      setSavePickerError(error instanceof Error ? error.message : '存档读取失败');
    } finally {
      setLoadingSave(false);
    }
  };

  const startNewGame = async () => {
    setLoadingSave(true);
    setSavePickerError('');
    try {
      const headers = { 'Content-Type': 'application/json', 'x-session': localStorage.getItem('weixun_session') || '' };
      const response = await fetch('/api/game/sessions', { method: 'POST', headers, body: JSON.stringify({ scenarioCode: location }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.gameSession) throw new Error(data?.error === 'SAVE_LIMIT_REACHED' ? `进行中存档已达 ${maxSaves} 个，请先载入并完成其中一个对局` : data?.error || '新游戏创建失败');
      await openSave(data.gameSession.id);
    } catch (error) {
      setSavePickerError(error instanceof Error ? error.message : '新游戏创建失败');
      setLoadingSave(false);
    }
  };

  const deleteSave = async (sessionId: string, replaceWithNew = false) => {
    setLoadingSave(true);
    setSavePickerError('');
    try {
      const response = await fetch(`/api/game/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'x-session': localStorage.getItem('weixun_session') || '' },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error === 'SAVE_NOT_DELETABLE' ? '该对局已结束，不能覆盖或删除' : data?.error || '存档删除失败');
      localStorage.removeItem(`game-session:${location}`);
      setActiveSaves((current) => current.filter((save) => save.id !== sessionId));
      setLoadingSave(false);
      if (replaceWithNew) await startNewGame();
    } catch (error) {
      setSavePickerError(error instanceof Error ? error.message : '存档删除失败');
      setLoadingSave(false);
    }
  };

  const runCommand = async (type: string, payload: Record<string, unknown> = {}) => {
    if (!gameSessionId || !gameState || commandBusyRef.current || streaming) return false;
    commandBusyRef.current = true;
    setCommandBusy(type);
    setCommandFeedback('');
    const signature = `${type}:${JSON.stringify(payload)}`;
    const commandId = retryCommandRef.current?.signature === signature ? retryCommandRef.current.commandId : makeCommandId();
    retryCommandRef.current = { signature, commandId };
    try {
      const response = await fetch(`/api/game/sessions/${gameSessionId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session': localStorage.getItem('weixun_session') || '' },
        body: JSON.stringify({ commandId, expectedVersion: gameState.version, type, payload }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || '操作失败，请稍后重试');
      const nextState = data?.state ?? data?.gameSession?.state;
      if (nextState) applyServerState(nextState);
      retryCommandRef.current = null;
      setCommandFeedback(commandResultMessage(type, data?.result));
      if (nextState?.status && nextState.status !== 'playing') router.push(`/result?sessionId=${gameSessionId}`);
      return true;
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败');
      return false;
    } finally {
      commandBusyRef.current = false;
      setCommandBusy(null);
    }
  };

  const sendMessage = async (
    content: string,
    communication?: { intent?: 'outreach' | 'message' | 'request_online' | 'call_connect'; channel?: Message['channel']; hidePlayerMessage?: boolean },
  ) => {
    if (!content.trim() || streaming || !selectedNpc || !gameSessionId || !gameState) return;
    const contact = gameState.npcContacts?.[selectedNpc];
    const intent = communication?.intent ?? (contact?.status === 'known' ? 'outreach' : 'message');
    const channel: Message['channel'] = communication?.channel ?? (activeMeeting?.npcId === selectedNpc
      ? 'offline'
      : communicationChannel);
    const chatSignature = `${selectedNpc}:${intent}:${channel}:${gameState.version}:${content.trim()}`;
    const chatCommandId = retryChatRef.current?.signature === chatSignature
      ? retryChatRef.current.commandId
      : makeCommandId();
    retryChatRef.current = { signature: chatSignature, commandId: chatCommandId };
    const userMessage: Message = { role: 'user', content: content.trim(), ts: Date.now(), deliveryStatus: 'sent', channel };
    // The scene renderer filters on channel. Preserve it on the optimistic
    // NPC placeholder so a successful face-to-face reply is visible directly,
    // not only after reloading the persisted conversation history.
    const assistantMessage: Message = { role: 'assistant', content: '', ts: Date.now() + 1, channel };
    setMessages((current) => communication?.hidePlayerMessage ? [...current, assistantMessage] : [...current, userMessage, assistantMessage]);
    setInput('');
    setStreaming(true);
    abortRef.current = new AbortController();
    typewriterQueueRef.current = [];
    if (typewriterTimerRef.current !== null) window.clearInterval(typewriterTimerRef.current);
    let networkComplete = false;
    let turnCommitted = false;
    const finishIfReady = () => {
      if (!networkComplete || typewriterQueueRef.current.length > 0) return;
      if (typewriterTimerRef.current !== null) window.clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
      setStreaming(false);
    };
    typewriterTimerRef.current = window.setInterval(() => {
      const backlog = typewriterQueueRef.current.length;
      if (!backlog) return finishIfReady();
      const visible = typewriterQueueRef.current.splice(0, backlog > 120 ? 3 : backlog > 60 ? 2 : 1).join('');
      setMessages((current) => current.map((item) => item.ts === assistantMessage.ts ? { ...item, content: item.content + visible } : item));
    }, 30);

    try {
      const deliveredPreparationIds = Array.from(new Set([
        ...selectedPreparations.filter((item) => item.status === 'delivered' || item.status === 'used').map((item) => item.id),
        ...(activeMeeting?.usedPreparationIds ?? []),
      ]));
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session': localStorage.getItem('weixun_session') || '' },
        body: JSON.stringify({
          gameSessionId,
          scenarioId: location,
          npcId: selectedNpc,
          message: userMessage.content,
          intent,
          channel,
          commandId: chatCommandId,
          expectedVersion: gameState.version,
          contextType: activeMeeting ? `${activeMeeting.visitType}_visit` : 'online',
          appointmentId: activeMeeting?.appointmentId,
          usedPreparationIds: deliveredPreparationIds,
          workTopicOpenedBy: activeMeeting?.workTopicOpenedBy,
        }),
        signal: abortRef.current.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null) as { error?: string; details?: unknown } | null;
        throw new Error(body?.error || `对话请求失败（HTTP ${response.status}）`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let received = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') {
            networkComplete = true;
            finishIfReady();
            continue;
          }
          try {
            const event = JSON.parse(raw);
            if (typeof event.content === 'string' && event.content) {
              received += event.content;
              const contentChunk = event.content as string;
              typewriterQueueRef.current.push(...Array.from(contentChunk));
            }
            if (event.type === 'result' && event.state) {
              applyServerState(event.state);
              retryChatRef.current = null;
              turnCommitted = true;
              if (event.deliveryStatus === 'unanswered') {
                setMessages((current) => current.map((item) => item.ts === userMessage.ts ? { ...item, deliveryStatus: 'unanswered' } : item));
                setMessages((current) => current.map((item) => item.ts === assistantMessage.ts ? { ...item, content: channel === 'work_phone' ? '（电话暂未接通，可以稍后换一种方式联系。）' : '（消息已送达，暂未收到回复。）' } : item));
              } else if (event.deliveryStatus === 'replied') {
                setMessages((current) => current.map((item) => item.ts === userMessage.ts ? { ...item, deliveryStatus: 'replied' } : item));
              }
            }
            if (event.type === 'error' && !received) {
              const detail = typeof event.code === 'string' ? ` ${event.code}` : '';
              setMessages((current) => current.map((item) => item.ts === assistantMessage.ts ? { ...item, content: `（${event.error || '服务暂时不可用'}${detail}）` } : item));
            }
          } catch {
            // 忽略无法识别的 SSE 心跳片段。
          }
        }
      }
      networkComplete = true;
      if (!turnCommitted && !communication?.hidePlayerMessage) setInput((current) => current || content.trim());
      finishIfReady();
    } catch (error) {
      console.error(error);
      typewriterQueueRef.current = [];
      if (typewriterTimerRef.current !== null) window.clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
      const reason = error instanceof Error ? error.message : '未知错误';
      setMessages((current) => current.map((item) => item.ts === assistantMessage.ts ? { ...item, content: `（本次未推进：${reason}。请重试。）` } : item));
      if (!communication?.hidePlayerMessage) setInput((current) => current || content.trim());
      setStreaming(false);
    }
  };

  const toggleRecording = () => {
    if (typeof window === 'undefined') return;
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Constructor) return alert('当前浏览器不支持语音识别，请使用 Chrome。');
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }
    const recognition = new Constructor();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) transcript += event.results[index][0].transcript;
      setInput(transcript);
    };
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const hasContacted = (npcId: string) => {
    const root = asRecord(gameState);
    const contactedIds = firstArray(root, ['contactedNpcIds', 'metNpcIds']);
    return gameState?.npcContacts?.[npcId]?.status !== 'known' || contactedIds.includes(npcId) || activeMeeting?.npcId === npcId;
  };

  const npcUnread = (npcId: string) => notifications.filter((item) => !item.read && item.npcId === npcId).length;
  const openContact = (npcId: string) => {
    if (activeMeeting && activeMeeting.npcId !== npcId) return;
    setSelectedNpc(npcId);
    setWorkspaceMode('conversation');
    setActionNpcId(npcId);
  };

  const submitInvitation = async () => {
    if (!selectedNpc) return;
    const success = await runCommand('invite', {
      npcId: selectedNpc,
      visitType: inviteDraft.visitType,
      invitationMethod: inviteDraft.approach === 'drop_by' ? 'drop_in' : 'dedicated',
      approach: inviteDraft.approach,
      travelMode: inviteDraft.approach,
      venue: inviteDraft.location,
      location: inviteDraft.location,
      purpose: inviteDraft.purpose,
      scheduledRound: inviteDraft.stage,
      stage: inviteDraft.stage,
      startMinute: parseMinuteLabel(inviteDraft.time),
      scheduledMinute: parseMinuteLabel(inviteDraft.time),
      scheduledTime: inviteDraft.time,
    });
    if (success) setWorkspaceMode('conversation');
  };

  const submitPreparation = async () => {
    if (!selectedNpc) return;
    const option = PREPARATION_OPTIONS.find((item) => item.type === preparationType);
    const success = await runCommand('prepare', {
      npcId: selectedNpc,
      appointmentId: preparationAppointmentId || undefined,
      preparationType,
      type: preparationType,
      title: option?.title,
    });
    if (success) setWorkspaceMode('conversation');
  };

  const selectedNpcName = selectedProfile?.name ?? '联系人';

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-900 flex flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white"><Building2 className="h-4 w-4" /></div>
            <div>
              <div className="text-sm font-bold">{scene.name}</div>
              <div className="text-[11px] text-slate-500">难度 {'★'.repeat(scene.difficulty)}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs">
            <span className="font-semibold text-blue-800">第{round}阶段 · {getPhaseName(round)}</span>
            <span className="text-blue-200">|</span>
            <span className="flex items-center gap-1 font-semibold"><Clock3 className="h-3.5 w-3.5 text-blue-600" />{formatClock(simulation.minuteOfDay)}</span>
            <span className="text-blue-200">|</span>
            <span>今日可用 <strong>{formatDuration(simulation.available)}</strong></span>
            <span className="text-blue-200">|</span>
            <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-amber-500" />行动点 <strong>{coins}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => runCommand('wait', { minutes: 30 })} disabled={Boolean(commandBusy) || streaming || Boolean(activeMeeting)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40">等待30分钟</button>
            <button onClick={() => runCommand('advance_phase')} disabled={Boolean(commandBusy) || streaming || Boolean(activeMeeting)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40">结束阶段</button>
            <button onClick={() => runCommand('submit')} disabled={Boolean(commandBusy) || streaming || Boolean(activeMeeting)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40">提交项目</button>
          </div>
        </div>
        {nextAppointment && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-600">
            <CalendarClock className="h-3.5 w-3.5 text-blue-600" />
            下一日程：第{nextAppointment.stage}阶段 {nextAppointment.scheduledLabel ?? formatClock(nextAppointment.scheduledMinute)} · {npcs.find((npc) => npc.id === nextAppointment.npcId)?.name ?? '联系人'} · {VISIT_LABELS[nextAppointment.visitType]} {nextAppointment.durationMinutes}分钟
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[250px_390px_minmax(480px,1fr)]">
        <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto xl:flex">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-xs font-bold text-slate-900">项目现场</div>
            <p className="text-xs leading-5 text-slate-600">{scene.description}</p>
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs">
              <div className="text-slate-500">公开预算</div>
              <div className="mt-1 text-lg font-bold text-blue-700">{scene.budget} 万</div>
            </div>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
              态度、支持度和中标条件已隐藏。请从回复速度、措辞、邀约结果和对方是否主动联系来判断局势。
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <button onClick={() => setShowResourceDetails((value) => !value)} className="flex w-full items-center justify-between text-left text-xs font-bold">
              <span className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-blue-600" />资源明细</span>
              <ChevronRight className={`h-4 w-4 transition ${showResourceDetails ? 'rotate-90' : ''}`} />
            </button>
            {showResourceDetails && (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <div className="flex justify-between"><span>今日已投入</span><strong>{formatDuration(todayInvestedMinutes)}</strong></div>
                <div className="flex justify-between"><span>今日已预约</span><strong>{formatDuration(todayReservedMinutes)}</strong></div>
                <div className="flex justify-between"><span>累计投入</span><strong>{formatDuration(simulation.totalMinutes)}</strong></div>
                <div className="flex justify-between"><span>累计消耗行动点</span><strong>{simulation.totalSpent}</strong></div>
              </div>
            )}
          </section>
          <button onClick={() => setShowCompetitors(true)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-300">
            <span className="flex items-center justify-between text-xs font-bold"><span className="flex items-center gap-2"><Users className="h-4 w-4 text-blue-600" />竞品动态</span><ChevronRight className="h-4 w-4" /></span>
            <span className="mt-2 block text-[11px] text-slate-500">查看公开竞品信息，不显示内部评分。</span>
          </button>
        </aside>

        <section className="relative mx-auto flex min-h-[680px] w-full max-w-[390px] flex-col overflow-hidden rounded-[34px] border-[8px] border-slate-900 bg-slate-50 shadow-2xl">
          <div className="flex items-center justify-between bg-slate-900 px-5 py-2 text-[10px] text-white">
            <span>{formatClock(simulation.minuteOfDay)}</span><span className="h-1.5 w-20 rounded-full bg-slate-700" /><span>项目专机</span>
          </div>
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div><div className="text-base font-bold">客户联络</div><div className="text-[10px] text-slate-500">模拟商务工作台</div></div>
              <button onClick={() => { setPhoneTab('messages'); setActionNpcId(null); }} aria-label={`查看消息，${unreadCount}条未读`} className="relative flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100"><Bell className="h-4 w-4" />{unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] text-white">{unreadCount}</span>}</button>
            </div>
          </div>
          <div className="grid grid-cols-3 border-b border-slate-200 bg-white">
            {([
              ['contacts', Users, '联系人'],
              ['messages', Inbox, '消息'],
              ['tasks', ListTodo, '待办'],
            ] as const).map(([tab, Icon, label]) => (
              <button key={tab} onClick={() => { setPhoneTab(tab); setActionNpcId(null); }} className={`relative flex items-center justify-center gap-1.5 py-3 text-xs font-semibold ${phoneTab === tab ? 'border-b-2 border-blue-600 text-blue-700' : 'text-slate-500'}`}>
                <Icon className="h-3.5 w-3.5" />{label}
                {tab === 'messages' && unreadCount > 0 && <span className="absolute right-6 top-2 h-2 w-2 rounded-full bg-red-500" />}
              </button>
            ))}
          </div>
          <div className="relative min-h-0 flex-1 overflow-y-auto p-3">
            {phoneTab === 'contacts' && (
              <div className="space-y-2">
                {npcs.map((npc) => {
                  const contacted = hasContacted(npc.id);
                  const unread = npcUnread(npc.id);
                  return (
                    <button key={npc.id} onClick={() => openContact(npc.id)} disabled={Boolean(activeMeeting && activeMeeting.npcId !== npc.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-40 ${selectedNpc === npc.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-200'}`}>
                      <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full ${contacted ? 'bg-gradient-to-br from-blue-500 to-indigo-700 text-lg font-bold text-white' : 'bg-slate-200 text-slate-500'}`}>
                        {contacted ? npc.name.slice(0, 1) : <UserRound className="h-6 w-6" />}
                        {unread > 0 && <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-red-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">{npc.name}</span><MoreHorizontal className="h-4 w-4 text-slate-400" /></div>
                        <div className="truncate text-[11px] text-slate-500">{npc.title}</div>
                        <div className="mt-1 text-[10px] text-slate-400">{contacted ? '已建立接触 · 照片占位' : '尚未有效接触'}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {phoneTab === 'messages' && (
              <div className="space-y-2">
                {notifications.length === 0 && <EmptyPhoneState icon={Mail} title="暂无主动消息" description="NPC的邀约回复、材料催办和项目变化会出现在这里。" />}
                {[...notifications].reverse().map((notification) => (
                  <button key={notification.id} onClick={async () => {
                    if (!notification.read) await runCommand('mark_notification_read', { notificationId: notification.id });
                    if (notification.npcId && (!activeMeeting || activeMeeting.npcId === notification.npcId)) { setSelectedNpc(notification.npcId); setWorkspaceMode('conversation'); }
                  }} className={`w-full rounded-2xl border p-3 text-left ${notification.read ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50'}`}>
                    <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold">{notification.title}</span>{!notification.read && <span className="h-2 w-2 rounded-full bg-red-500" />}</div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-600">{notification.body}</p>
                    {notification.createdLabel && <div className="mt-1 text-[9px] text-slate-400">{notification.createdLabel}</div>}
                  </button>
                ))}
              </div>
            )}
            {phoneTab === 'tasks' && (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] font-bold"><span>预约</span><span className="text-slate-400">{appointments.length}</span></div>
                  <div className="space-y-2">
                    {appointments.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-[11px] text-slate-500">尚无预约</div>}
                    {appointments.map((appointment) => (
                      <button key={appointment.id} onClick={() => { if (!activeMeeting || activeMeeting.npcId === appointment.npcId) { setSelectedNpc(appointment.npcId); setWorkspaceMode('conversation'); } }} disabled={Boolean(activeMeeting && activeMeeting.npcId !== appointment.npcId)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left disabled:opacity-40">
                        <div className="flex items-center justify-between"><span className="text-xs font-bold">{VISIT_LABELS[appointment.visitType]}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px]">{STATUS_LABELS[appointment.status] ?? appointment.status}</span></div>
                        <div className="mt-1 text-[10px] text-slate-500">第{appointment.stage}阶段 · {appointment.scheduledLabel ?? formatClock(appointment.scheduledMinute)} · {appointment.durationMinutes}分钟</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] font-bold"><span>已准备</span><span className="text-slate-400">{preparations.length}</span></div>
                  <div className="space-y-2">
                    {preparations.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-[11px] text-slate-500">尚未准备材料或礼品</div>}
                    {preparations.map((preparation) => <div key={preparation.id} className="rounded-xl border border-slate-200 bg-white p-3 text-[11px]"><div className="font-semibold">{preparation.title}</div><div className="mt-1 text-slate-400">{preparation.status === 'used' ? '已使用' : '可在拜访中使用'}</div></div>)}
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-[11px] font-bold"><span>拜访纪要</span><span className="text-slate-400">{meetingMinutes.length}</span></div>
                  <div className="space-y-2">
                    {meetingMinutes.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-[11px] text-slate-500">完成拜访后自动生成</div>}
                    {meetingMinutes.map((minutes) => (
                      <button key={minutes.id} onClick={() => { if (!activeMeeting || activeMeeting.npcId === minutes.npcId) { setSelectedNpc(minutes.npcId); setWorkspaceMode('conversation'); } }} disabled={Boolean(activeMeeting && activeMeeting.npcId !== minutes.npcId)} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left text-[10px] disabled:opacity-40">
                        <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold">{VISIT_LABELS[minutes.visitType]}纪要</span><span className="text-slate-400">第{minutes.nextStepRound}阶段 {formatClock(minutes.nextStepMinute)}</span></div>
                        <p className="mt-1 leading-4 text-slate-600">{minutes.summary}</p>
                        {minutes.confirmedItems.length > 0 && <div className="mt-2"><strong>确认事项：</strong>{minutes.confirmedItems.join('；')}</div>}
                        {minutes.npcCommitments.length > 0 && <div className="mt-1"><strong>客户承诺：</strong>{minutes.npcCommitments.join('；')}</div>}
                        <div className="mt-1"><strong>我方承诺：</strong>{minutes.playerCommitments.join('；')}</div>
                        {minutes.pendingMaterials.length > 0 && <div className="mt-1 text-amber-700"><strong>待补材料：</strong>{minutes.pendingMaterials.join('、')}</div>}
                        <div className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-slate-500">下一步：{minutes.nextStep} · {minutes.owner}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 border-t border-slate-200 bg-white px-3 py-3 text-[10px] text-slate-500">
            <button onClick={() => setPhoneTab('contacts')} className="flex flex-col items-center gap-1"><Phone className="h-4 w-4" />通讯录</button>
            <button onClick={() => setPhoneTab('messages')} className="relative flex flex-col items-center gap-1"><MessageCircle className="h-4 w-4" />消息{unreadCount > 0 && <span className="absolute right-7 top-0 h-2 w-2 rounded-full bg-red-500" />}</button>
            <button onClick={() => setPhoneTab('tasks')} className="flex flex-col items-center gap-1"><CalendarClock className="h-4 w-4" />日程</button>
          </div>
          {actionNpcId && phoneTab === 'contacts' && (
            <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-slate-200 bg-white p-4 shadow-[0_-12px_32px_rgba(15,23,42,.18)]">
              <div className="mb-3 flex items-center justify-between"><div><div className="text-sm font-bold">{npcs.find((npc) => npc.id === actionNpcId)?.name}</div><div className="text-[10px] text-slate-500">选择下一步行动</div></div><button onClick={() => setActionNpcId(null)}><X className="h-4 w-4" /></button></div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => { setSelectedNpc(actionNpcId); setWorkspaceMode('conversation'); setActionNpcId(null); }} className="rounded-xl bg-blue-50 p-3 text-center text-[11px] font-semibold text-blue-700"><MessageCircle className="mx-auto mb-1 h-5 w-5" />线上联系</button>
                <button onClick={() => { setSelectedNpc(actionNpcId); setWorkspaceMode('appointment'); setInviteDraft((current) => ({ ...current, stage: round })); setActionNpcId(null); }} disabled={Boolean(activeMeeting) || !gameState?.npcContacts[actionNpcId]?.hasReplied || gameState?.npcContacts[actionNpcId]?.status === 'known'} title={!gameState?.npcContacts[actionNpcId]?.hasReplied ? '完成一次双向沟通后才能邀约' : undefined} className="rounded-xl bg-emerald-50 p-3 text-center text-[11px] font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><CalendarClock className="mx-auto mb-1 h-5 w-5" />邀约见面</button>
                <button onClick={() => { setSelectedNpc(actionNpcId); setWorkspaceMode('preparation'); setActionNpcId(null); }} disabled={Boolean(activeMeeting)} className="rounded-xl bg-amber-50 p-3 text-center text-[11px] font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"><FileText className="mx-auto mb-1 h-5 w-5" />拜访准备</button>
              </div>
            </div>
          )}
        </section>

        <main className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full ${selectedNpc && hasContacted(selectedNpc) ? 'bg-gradient-to-br from-blue-500 to-indigo-700 font-bold text-white' : 'bg-slate-200 text-slate-500'}`}>{selectedNpc && hasContacted(selectedNpc) ? selectedNpcName.slice(0, 1) : <UserRound className="h-5 w-5" />}</div>
              <div><div className="text-sm font-bold">{selectedNpcName}</div><div className="text-[11px] text-slate-500">{selectedProfile?.title ?? '请在手机中选择联系人'}{selectedContact ? ` · ${selectedContact.status === 'known' ? '待建联' : selectedContact.status === 'online' ? '可线上联系' : '已建联'}` : ''}</div></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeMeeting?.npcId === selectedNpc && <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700">{VISIT_LABELS[activeMeeting.visitType]} · {activeMeeting.turnCount}/{activeMeeting.maxTurns}轮</span>}
              {selectedNpc && selectedContact?.status === 'connected' && !activeMeeting && <button onClick={() => sendMessage('方便添加一下您的线上联系方式吗？后续项目资料我可以及时同步给您。', { intent: 'request_online', channel: selectedContact.initialChannel })} disabled={streaming} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold text-blue-700 disabled:opacity-40">申请线上联系方式</button>}
              {selectedNpc && <button onClick={() => setWorkspaceMode('appointment')} disabled={Boolean(activeMeeting) || !canInviteSelected} title={!canInviteSelected ? '完成一次双向沟通后才能邀约' : undefined} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">邀约</button>}
              {selectedNpc && latestCompletedAppointment && !activeMeeting && <button onClick={() => setWorkspaceMode('follow_up')} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">会后待办</button>}
              {selectedNpc && <button onClick={() => setWorkspaceMode('preparation')} disabled={Boolean(activeMeeting)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">准备</button>}
            </div>
          </div>

          {workspaceMode === 'appointment' && selectedNpc && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-2xl">
                <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">邀约 {selectedNpcName}</h2><p className="mt-1 text-xs text-slate-500">选择方式、场合和时间；NPC可能接受、拒绝或提出改期。</p></div><button onClick={() => setWorkspaceMode('conversation')} className="rounded-lg border border-slate-200 p-2"><X className="h-4 w-4" /></button></div>
                {!canInviteSelected && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">需要先完成一次有效的双向沟通，再发起线下邀约。</div>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="拜访类型"><select value={inviteDraft.visitType} onChange={(event) => setInviteDraft((current) => ({ ...current, visitType: event.target.value as AppointmentView['visitType'] }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"><option value="short">短时拜访 · 5分钟</option><option value="formal">正式拜访 · 40分钟</option><option value="informal">非正式拜访 · 60分钟</option></select></Field>
                  <Field label="邀约方式"><select value={inviteDraft.approach} onChange={(event) => setInviteDraft((current) => ({ ...current, approach: event.target.value as AppointmentView['approach'] }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"><option value="dedicated">专程拜访 · 表达重视</option><option value="drop_by">顺路拜访 · 自然切入</option></select></Field>
                  <Field label="阶段"><select value={inviteDraft.stage} onChange={(event) => setInviteDraft((current) => ({ ...current, stage: Number(event.target.value) }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">{Array.from({ length: Math.max(1, (gameState?.maxRounds ?? 5) - round + 1) }, (_, index) => round + index).map((stage) => <option key={stage} value={stage}>第{stage}阶段 · {getPhaseName(stage)}</option>)}</select></Field>
                  <Field label="时间"><input type="time" value={inviteDraft.time} onChange={(event) => setInviteDraft((current) => ({ ...current, time: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400" /></Field>
                  <Field label="地点"><input value={inviteDraft.location} onChange={(event) => setInviteDraft((current) => ({ ...current, location: event.target.value }))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400" /></Field>
                  <Field label="拜访时长"><div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">{VISIT_DURATIONS[inviteDraft.visitType]}分钟（固定）</div></Field>
                </div>
                <Field label="拜访目的"><textarea value={inviteDraft.purpose} onChange={(event) => setInviteDraft((current) => ({ ...current, purpose: event.target.value }))} rows={3} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400" /></Field>
                {inviteDraft.visitType === 'informal' && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">非正式场合默认先不谈工作。由NPC主动开启项目话题后，再自然回应。</div>}
                <button onClick={submitInvitation} disabled={Boolean(commandBusy) || !inviteDraft.purpose.trim() || !canInviteSelected} className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{commandBusy === 'invite' ? '正在发送...' : '发送邀约'}</button>
              </div>
            </div>
          )}

          {workspaceMode === 'preparation' && selectedNpc && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-2xl">
                <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">为 {selectedNpcName} 做拜访准备</h2><p className="mt-1 text-xs text-slate-500">材料与礼品先进入库存，实际递交时才影响NPC。</p></div><button onClick={() => setWorkspaceMode('conversation')} className="rounded-lg border border-slate-200 p-2"><X className="h-4 w-4" /></button></div>
                <div className="space-y-2">
                  {PREPARATION_OPTIONS.map((option) => (
                    <button key={option.type} onClick={() => setPreparationType(option.type)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${preparationType === option.type ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${option.type === 'boundary_gift' ? 'bg-red-100 text-red-700' : option.type.includes('gift') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{option.type.includes('gift') ? <Gift className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</div>
                      <div className="min-w-0 flex-1"><div className="text-sm font-bold">{option.title}</div><div className="mt-1 text-[11px] text-slate-500">{option.description}</div></div>
                      <div className="text-right text-[10px] text-slate-500"><div>{option.minutes}分钟</div><div>{option.cost}行动点</div></div>
                    </button>
                  ))}
                </div>
                {selectedAppointments.length > 0 && <Field label="绑定预约（可选）"><select value={preparationAppointmentId} onChange={(event) => setPreparationAppointmentId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"><option value="">作为通用材料</option>{selectedAppointments.filter((item) => ['pending', 'accepted', 'countered'].includes(item.status)).map((item) => <option key={item.id} value={item.id}>{VISIT_LABELS[item.visitType]} · 第{item.stage}阶段 {item.scheduledLabel ?? formatClock(item.scheduledMinute)}</option>)}</select></Field>}
                {preparationType === 'boundary_gift' && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">高波动边界礼品存在更高潜在收益，也可能被拒收、上报或在后续审计中反噬；明确的现金、回扣和利益交换不会产生正收益。</div>}
                <button onClick={submitPreparation} disabled={Boolean(commandBusy)} className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40">{commandBusy === 'prepare' ? '准备中...' : '确认准备'}</button>
              </div>
            </div>
          )}

          {workspaceMode === 'follow_up' && selectedNpc && latestCompletedAppointment && (
            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
              <div className="mx-auto max-w-2xl">
                <div className="mb-5 flex items-center justify-between"><div><div className="text-xs font-semibold tracking-[0.16em] text-violet-600">VISIT FOLLOW-UP</div><h2 className="mt-1 text-xl font-bold text-slate-900">与 {selectedNpcName} 的会后待办</h2><p className="mt-1 text-xs text-slate-500">先确认纪要，再选择需要兑现的动作；每项会按所选渠道消耗对应模拟时间。</p></div><button onClick={() => setWorkspaceMode('conversation')} className="rounded-lg border border-slate-200 bg-white p-2"><X className="h-4 w-4" /></button></div>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div className="text-sm font-bold">拜访纪要</div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">{VISIT_LABELS[latestCompletedAppointment.visitType]}</span></div><p className="mt-3 text-sm leading-6 text-slate-700">{latestSelectedMinutes?.summary || '本次拜访已完成，请根据约定安排后续。'}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3 text-xs"><strong className="text-slate-700">客户承诺</strong><p className="mt-1 leading-5 text-slate-500">{latestSelectedMinutes?.npcCommitments.join('；') || '暂无明确承诺'}</p></div><div className="rounded-xl bg-slate-50 p-3 text-xs"><strong className="text-slate-700">我方承诺</strong><p className="mt-1 leading-5 text-slate-500">{latestSelectedMinutes?.playerCommitments.join('；') || '确认下一步沟通安排'}</p></div></div></section>
                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-bold text-slate-900">下一步动作</h3><div className="mt-3 space-y-3"><button onClick={() => void runCommand('follow_up', { npcId: selectedNpc, appointmentId: latestCompletedAppointment.id, channel: communicationChannel, content: '感谢您今天抽时间交流。我已整理会谈要点和后续事项，如有遗漏请您指正。', preparationIds: [] })} disabled={Boolean(commandBusy) || streaming} className="flex w-full items-center justify-between rounded-xl border border-violet-200 bg-violet-50 p-4 text-left disabled:opacity-40"><span><strong className="block text-sm text-violet-900">发送感谢与纪要确认</strong><span className="mt-1 block text-[11px] text-violet-700">确认已沟通事项与下一步负责人</span></span><ChevronRight className="h-4 w-4 text-violet-700" /></button><button onClick={() => void runCommand('follow_up', { npcId: selectedNpc, appointmentId: latestCompletedAppointment.id, channel: communicationChannel, content: '按我们会面时的约定，补发相关方案材料供您内部参考。', preparationIds: selectedPreparations.filter((item) => item.status === 'ready' && (item.type === 'materials' || item.type === 'ppt')).map((item) => item.id) })} disabled={Boolean(commandBusy) || streaming || !selectedPreparations.some((item) => item.status === 'ready' && (item.type === 'materials' || item.type === 'ppt'))} className="flex w-full items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 text-left disabled:opacity-40"><span><strong className="block text-sm text-blue-900">补发 PPT / 方案材料</strong><span className="mt-1 block text-[11px] text-blue-700">仅发送已准备且尚未使用的材料</span></span><ChevronRight className="h-4 w-4 text-blue-700" /></button></div></section>
                {latestSelectedMinutes?.pendingMaterials.length ? <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><strong>待补材料：</strong>{latestSelectedMinutes.pendingMaterials.join('；')}</section> : null}
              </div>
            </div>
          )}

          {workspaceMode === 'conversation' && (
            <>
              {activeMeeting?.npcId === selectedNpc && (
                <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs"><MapPin className="h-4 w-4 text-emerald-700" /><strong>{VISIT_LABELS[activeMeeting.visitType]}</strong><span className="text-emerald-800">固定用时 {activeMeeting.durationMinutes}分钟 · 对话上限 {activeMeeting.maxTurns}轮</span></div>
                    <button onClick={() => runCommand('end_visit', { appointmentId: activeMeeting.appointmentId, reason: 'player', summary: '' })} disabled={Boolean(commandBusy) || streaming} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-800 disabled:opacity-40">结束拜访</button>
                  </div>
                  {activeMeeting.visitType === 'informal' && activeMeeting.workTopicOpenedBy !== 'npc' && <div className="mt-2 text-[11px] text-amber-800">当前是非正式交流，建议先聊生活与兴趣，等待对方自然谈到工作。</div>}
                  {selectedPreparations.filter((item) => item.status !== 'delivered' && item.status !== 'used').length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedPreparations.map((item) => {
                        const usedInMeeting = activeMeeting.usedPreparationIds.includes(item.id) || item.status === 'used';
                        return <button key={item.id} onClick={() => item.type.includes('gift')
                          ? runCommand('give_gift', { preparationId: item.id, appointmentId: activeMeeting.appointmentId, setting: activeMeeting.visitType === 'informal' ? 'private' : 'public', witnesses: [], exchangeRequested: false })
                          : runCommand('follow_up', { action: 'deliver_preparation', npcId: selectedNpc, appointmentId: activeMeeting.appointmentId, preparationId: item.id })
                        } disabled={Boolean(commandBusy) || streaming || usedInMeeting} className={`rounded-full border px-3 py-1 text-[10px] font-semibold disabled:opacity-40 ${usedInMeeting ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-emerald-200 bg-white text-emerald-800'}`}><PackageCheck className="mr-1 inline h-3 w-3" />{usedInMeeting ? '已使用' : item.type.includes('gift') ? '赠送' : '递交'}：{item.title}</button>;
                      })}
                    </div>
                  )}
                </div>
              )}
              {selectedAppointments.some((item) => item.status === 'countered') && !activeMeeting && (
                <div className="border-b border-amber-100 bg-amber-50 px-5 py-3">
                  {selectedAppointments.filter((item) => item.status === 'countered').map((appointment) => (
                    <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div><strong>对方提出改期</strong><span className="ml-2 text-slate-600">第{appointment.stage}阶段 {appointment.scheduledLabel ?? formatClock(appointment.scheduledMinute)} · {appointment.location}</span>{appointment.conditions.length > 0 && <div className="mt-1 text-[10px] text-amber-800">条件：{appointment.conditions.join('；')}</div>}</div>
                      <div className="flex gap-2"><button onClick={() => runCommand('update_appointment', { appointmentId: appointment.id, action: 'cancel' })} disabled={Boolean(commandBusy)} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-40">取消</button><button onClick={() => runCommand('update_appointment', { appointmentId: appointment.id, action: 'accept_counter' })} disabled={Boolean(commandBusy)} className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white disabled:opacity-40">接受改期</button></div>
                    </div>
                  ))}
                </div>
              )}
              {selectedAppointments.some((item) => item.status === 'accepted') && !activeMeeting && (
                <div className="border-b border-blue-100 bg-blue-50 px-5 py-3">
                  {selectedAppointments.filter((item) => item.status === 'accepted').map((appointment) => (
                    <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div><strong>{VISIT_LABELS[appointment.visitType]}</strong><span className="ml-2 text-slate-600">第{appointment.stage}阶段 {appointment.scheduledLabel ?? formatClock(appointment.scheduledMinute)} · {appointment.location}</span></div>
                      <div className="flex gap-2"><button onClick={() => runCommand('update_appointment', { appointmentId: appointment.id, action: 'cancel' })} disabled={Boolean(commandBusy) || streaming} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-semibold text-blue-700 disabled:opacity-40">取消</button><button onClick={() => runCommand('start_visit', { appointmentId: appointment.id })} disabled={Boolean(commandBusy) || streaming || appointment.stage !== round} title={appointment.stage !== round ? `请在第${appointment.stage}阶段开始拜访` : undefined} className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Play className="mr-1 inline h-3 w-3" />{appointment.stage === round ? '开始拜访' : '等待预约阶段'}</button></div>
                    </div>
                  ))}
                </div>
              )}
              {selectedAppointments.some((item) => item.status === 'completed') && !activeMeeting && selectedNpc && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-100 bg-violet-50 px-5 py-3 text-xs"><div><strong>拜访已完成</strong><span className="ml-2 text-slate-600">纪要、材料与承诺统一放入会后待办。</span></div><button onClick={() => setWorkspaceMode('follow_up')} className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 font-semibold text-white">查看会后待办</button></div>
              )}
              {activeMeeting?.npcId === selectedNpc && (
                <section className="relative m-4 min-h-[560px] flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
                  <div className="absolute inset-0 bg-cover bg-center opacity-95" style={{ backgroundImage: "url('/images/game/visit-dialogue-scene-v1.png')" }} />
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-slate-950/90" />
                  <div className="relative flex h-full min-h-[560px] flex-col justify-between p-5">
                    <div className="flex items-start justify-between gap-4 text-white">
                      <div><div className="text-xs font-semibold tracking-[0.22em] text-amber-200">线下拜访现场</div><h2 className="mt-1 text-xl font-bold">{selectedAppointments.find((item) => item.id === activeMeeting.appointmentId)?.location || '客户会面场景'}</h2><p className="mt-1 text-xs text-white/75">{VISIT_LABELS[activeMeeting.visitType]} · {activeMeeting.durationMinutes} 分钟 · 第 {activeMeeting.turnCount}/{activeMeeting.maxTurns} 轮</p></div>
                      <div className="flex items-center gap-2 rounded-full bg-slate-950/55 px-3 py-2 text-xs backdrop-blur"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 font-bold">我</span><span className="text-white/70">↔</span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 font-bold">{selectedNpcName.slice(0, 1)}</span></div>
                    </div>
                    <div className="mx-auto w-full max-w-3xl space-y-3 rounded-2xl border border-white/20 bg-slate-950/65 p-4 shadow-2xl backdrop-blur-md">
                      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                        {messages.filter((message) => message.channel === 'offline').slice(-4).map((message) => (
                          <div key={message.ts} className={`flex items-start gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-amber-400 text-slate-900'}`}>{message.role === 'user' ? '我' : selectedNpcName.slice(0, 1)}</div>
                            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-slate-800'}`}>{message.content || (streaming ? '对方正在思考…' : '')}</div>
                          </div>
                        ))}
                        {messages.filter((message) => message.channel === 'offline').length === 0 && <div className="rounded-xl bg-white/10 px-4 py-3 text-center text-sm text-white/85">面谈开始。请根据场景和对方状态自然展开交流。</div>}
                      </div>
                      <div className="flex items-end gap-2 border-t border-white/15 pt-3"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(input); } }} disabled={streaming} rows={2} placeholder="输入你在现场说的话…" className="min-h-[56px] flex-1 resize-none rounded-xl border border-white/20 bg-white/95 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-300" /><button onClick={() => sendMessage(input)} disabled={streaming || !input.trim()} className="rounded-xl bg-amber-400 p-3 text-slate-900 disabled:opacity-40"><Send className="h-4 w-4" /></button></div>
                    </div>
                  </div>
                </section>
              )}
              {!activeMeeting && selectedNpc && (
                <div className="border-b border-slate-200 bg-white px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-semibold text-slate-500">沟通方式</span>{(Object.keys(CHANNEL_META) as CommunicationChannel[]).map((channel) => <button key={channel} onClick={() => { setCommunicationChannel(channel); setPhoneCallActive(false); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${communicationChannel === channel ? CHANNEL_META[channel].accent : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>{channel === 'email' ? <Mail className="mr-1 inline h-3.5 w-3.5" /> : channel === 'work_phone' ? <Phone className="mr-1 inline h-3.5 w-3.5" /> : <MessageCircle className="mr-1 inline h-3.5 w-3.5" />}{CHANNEL_META[channel].label}</button>)}</div>
                  <div className="mt-2 text-[11px] text-slate-400">{CHANNEL_META[communicationChannel].hint}</div>
                </div>
              )}
              <div className={`h-[430px] shrink-0 overflow-y-auto p-5 ${activeMeeting ? 'hidden' : communicationChannel === 'online' ? 'bg-[#ededed]' : communicationChannel === 'email' ? 'bg-slate-100' : 'bg-slate-950'}`}>
                {selectedNpc && !activeMeeting && <div className={`mx-auto mb-4 max-w-2xl rounded-2xl border p-4 shadow-sm ${communicationChannel === 'online' ? 'border-emerald-200 bg-emerald-600 text-white' : communicationChannel === 'email' ? 'border-slate-200 bg-white text-slate-800' : 'border-violet-200 bg-gradient-to-r from-violet-700 to-indigo-700 text-white'}`}><div className="flex items-center gap-2 text-sm font-bold">{communicationChannel === 'email' ? <Mail className="h-4 w-4" /> : communicationChannel === 'work_phone' ? <Phone className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}{communicationChannel === 'email' ? `写给 ${selectedNpcName} 的邮件` : communicationChannel === 'work_phone' ? `与 ${selectedNpcName} 的工作电话` : `微信 · ${selectedNpcName}`}</div><div className={`mt-1 text-[11px] ${communicationChannel === 'email' ? 'text-slate-400' : 'text-white/70'}`}>{communicationChannel === 'email' ? '收件人：客户联系人　主题：项目沟通' : communicationChannel === 'work_phone' ? '请在关键事实与结论上保持简洁' : '即时沟通，请注意语气与分寸'}</div></div>}
                {!selectedNpc && <EmptyPhoneState icon={Users} title="选择一位联系人" description="在手机通讯录中点击头像，再选择线上联系、邀约见面或拜访准备。" />}
              {selectedNpc && !activeMeeting && communicationChannel === 'work_phone' && <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center text-white"><div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-4xl font-bold shadow-[0_0_50px_rgba(168,85,247,.55)]">{selectedNpcName.slice(0, 1)}</div><h3 className="mt-5 text-xl font-bold">{selectedNpcName}</h3><p className="mt-1 text-sm text-violet-200">{phoneCallActive ? (streaming ? '正在接通…' : '通话已接通') : '准备拨打工作电话'}</p>{phoneCallActive ? <div className="mt-7 w-full rounded-2xl bg-white/10 p-4 text-left"><div className="mb-2 text-xs text-violet-200">本次通话记录</div><div className="max-h-28 space-y-2 overflow-y-auto text-sm">{visibleChannelMessages.filter((message) => message.content !== '[电话呼出]').slice(-3).map((message) => <p key={message.ts} className="leading-5"><strong>{message.role === 'user' ? '我：' : `${selectedNpcName}：`}</strong>{message.content || (streaming ? '…' : '')}</p>)}</div></div> : <button onClick={() => { setPhoneCallActive(true); void sendMessage('[电话呼出]', { intent: 'call_connect', channel: 'work_phone', hidePlayerMessage: true }); }} disabled={!selectedNpc || streaming} className="mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-400 disabled:opacity-40"><Phone className="h-6 w-6" /></button>}</div>}
                {selectedNpc && !activeMeeting && communicationChannel !== 'work_phone' && visibleChannelMessages.length === 0 && <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center"><MessageCircle className="mx-auto h-8 w-8 text-blue-500" /><div className="mt-3 text-sm font-bold">开始与 {selectedNpcName} 沟通</div><div className="mt-2 text-xs leading-5 text-slate-500">对方的真实态度不会直接显示，请留意措辞、回复节奏与后续行动。</div></div>}
                {selectedNpc && !activeMeeting && communicationChannel === 'online' && <div className="mx-auto max-w-2xl space-y-3">{visibleChannelMessages.map((message) => <div key={message.ts} className={`flex items-end gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded text-xs font-bold ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-slate-500 shadow-sm'}`}>{message.role === 'user' ? '我' : selectedNpcName.slice(0, 1)}</div><div><div className={`max-w-[420px] rounded-md px-3 py-2 text-sm leading-6 shadow-sm ${message.role === 'user' ? 'bg-[#95ec69] text-slate-900' : 'bg-white text-slate-800'}`}>{message.content || (streaming ? '正在输入…' : '')}</div><div className={`mt-1 text-[10px] text-slate-400 ${message.role === 'user' ? 'text-right' : ''}`}>{formatMessageTime(message.ts)}{message.role === 'user' && message.deliveryStatus === 'replied' ? ' · 已读' : ''}</div></div></div>)}</div>}
                {selectedNpc && !activeMeeting && communicationChannel === 'email' && <div className="mx-auto max-w-2xl space-y-3">{visibleChannelMessages.map((message) => <article key={message.ts} className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500"><div><strong className="text-slate-800">{message.role === 'user' ? '我方' : selectedNpcName}</strong>　收件人：{message.role === 'user' ? selectedNpcName : '我方'}</div><div className="mt-1">主题：项目沟通　·　{formatMessageTime(message.ts)}</div></div><p className="whitespace-pre-wrap px-4 py-3 text-sm leading-6 text-slate-800">{message.content || (streaming ? '正在发送…' : '')}</p></article>)}</div>}
                <div ref={messagesEndRef} />
              </div>
              <div className={`border-t border-slate-200 bg-white p-4 ${activeMeeting ? 'hidden' : ''}`}>
                {commandFeedback && <div className="mb-2 flex items-center gap-1.5 text-[11px] text-emerald-700"><Check className="h-3.5 w-3.5" />{commandFeedback}</div>}
                {communicationChannel === 'work_phone' && !phoneCallActive ? <div className="flex items-center justify-between rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900"><span>点击上方绿色按钮拨打电话；接通后可输入通话要点。</span><Phone className="h-4 w-4" /></div> : <div className="flex items-end gap-2">
                  <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(input); } }} disabled={!selectedNpc || streaming} rows={3} placeholder={selectedContact?.status === 'known' ? '输入首次建联内容…' : communicationChannel === 'email' ? '撰写邮件正文…' : communicationChannel === 'work_phone' ? '输入电话话术…' : '输入微信消息…'} className="min-h-[76px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-100" />
                  <button onClick={toggleRecording} disabled={!selectedNpc || streaming} className={`rounded-xl border p-3 ${isRecording ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200 text-slate-500'}`}>{isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
                  <button onClick={() => sendMessage(input)} disabled={!selectedNpc || streaming || !input.trim()} className="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
                </div>}
                <div className="mt-2 text-[10px] text-slate-400">线上消息5分钟 · 邮件10分钟 · 工作电话15分钟；AI响应等待不消耗模拟时间。</div>
              </div>
            </>
          )}
        </main>
      </div>

      {!gameState && savePickerReady && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 px-7 py-6 text-white"><div className="text-xs font-semibold tracking-[0.2em] text-blue-100">项目演练</div><h1 className="mt-2 text-2xl font-bold">选择进入方式</h1><p className="mt-2 text-sm text-blue-100">已结束对局会保留在历史记录中，不会再作为可继续的存档出现。</p></div>
            <div className="max-h-[58vh] overflow-y-auto p-6"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">进行中存档</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{activeSaves.length} / {maxSaves}</span></div>
              {activeSaves.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">当前没有可继续的对局。开始一局新游戏吧。</div> : <div className="space-y-2">{activeSaves.map((save, index) => <button key={save.id} onClick={() => void openSave(save.id)} disabled={loadingSave} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"><div><div className="text-sm font-bold text-slate-800">存档 {index + 1} · {getPhaseName(save.currentRound)}</div><div className="mt-1 text-xs text-slate-500">第 {save.currentRound} / {save.maxRounds} 阶段 · 最近保存 {new Date(save.updatedAt).toLocaleString('zh-CN')}</div></div><ChevronRight className="h-5 w-5 text-blue-600" /></button>)}</div>}
              {activeSaves.length > 0 && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="mb-2 text-xs font-semibold text-slate-600">管理存档</div><div className="space-y-2">{activeSaves.map((save, index) => <div key={`manage-${save.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"><span className="min-w-0 truncate text-xs text-slate-600">存档 {index + 1} · 第 {save.currentRound} 阶段</span><span className="flex shrink-0 gap-2"><button onClick={() => void deleteSave(save.id)} disabled={loadingSave} className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40">删除</button>{activeSaves.length >= maxSaves && <button onClick={() => void deleteSave(save.id, true)} disabled={loadingSave} className="rounded-md bg-orange-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40">覆盖新开</button>}</span></div>)}</div></div>}
              {savePickerError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{savePickerError}</div>}
              <button onClick={() => void startNewGame()} disabled={loadingSave || activeSaves.length >= maxSaves} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Play className="h-4 w-4" />{loadingSave ? '正在载入…' : activeSaves.length >= maxSaves ? `进行中存档已满（最多 ${maxSaves} 个）` : '开始新游戏'}</button>
              <p className="mt-3 text-center text-[11px] text-slate-400">结束后的对局请在历史对局或结果页查看。</p>
            </div>
          </div>
        </div>
      )}

      {showCompetitors && (
        <Modal title="竞品公开信息" onClose={() => setShowCompetitors(false)}>
          {competitors.length === 0 ? <div className="py-10 text-center text-sm text-slate-500">暂无竞品数据</div> : <div className="space-y-3">{competitors.map((competitor) => <div key={competitor.company_name} className="rounded-xl border border-slate-200 p-4"><div className="text-sm font-bold text-blue-700">{competitor.company_name}</div><div className="mt-2 text-xs text-slate-700">{competitor.features}</div><div className="mt-1 text-[11px] text-slate-500">{competitor.more_info || '暂无更多公开信息'}</div></div>)}</div>}
        </Modal>
      )}

      {newlyUnlockedNpcId && (() => {
        const unlocked = getProjectOneNpc(newlyUnlockedNpcId);
        if (!unlocked) return null;
        return <Modal title="新人物已发现" onClose={() => setNewlyUnlockedNpcId(null)}><div className="py-4 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 text-2xl font-bold text-white">{unlocked.name.slice(0, 1)}</div><div className="mt-4 text-xl font-bold">{unlocked.name}</div><div className="mt-1 text-sm text-slate-500">{unlocked.title}</div><button onClick={() => { setSelectedNpc(unlocked.id); setPhoneTab('contacts'); setWorkspaceMode('conversation'); setNewlyUnlockedNpcId(null); }} className="mt-5 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white">查看联系人</button></div></Modal>;
      })()}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>{children}</label>;
}

function EmptyPhoneState({ icon: Icon, title, description }: { icon: typeof Mail; title: string; description: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon className="h-6 w-6" /></div><div className="mt-3 text-sm font-bold text-slate-700">{title}</div><div className="mt-1 text-[11px] leading-5 text-slate-500">{description}</div></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}><div className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="text-base font-bold">{title}</h2><button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="max-h-[calc(82vh-64px)] overflow-y-auto p-5">{children}</div></div></div>;
}
