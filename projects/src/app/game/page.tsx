'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
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
  Search,
  Sparkles,
  UserRound,
  Users,
  WalletCards,
  X,
} from 'lucide-react';
import { getPhaseName, isCurrentPreparationType, type CompetitorActionRecord, type GamePublicResearchRecord, type GameRuntimeState } from '@/lib/game/state';

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
  brief?: {
    audience: string;
    problem: string;
    dimensions: string;
    evidence: string;
    nextStep: string;
  };
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
  revisionCount: number;
}

interface InvitationResultView {
  appointment: AppointmentView;
  npcName: string;
  npcTitle: string;
  feedback: string;
}

interface MeetingMinutesDraft {
  id: string;
  summary: string;
  confirmedItems: string;
  npcCommitments: string;
  playerCommitments: string;
  nextStep: string;
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
type WorkspaceMode = 'conversation' | 'preparation' | 'follow_up';
type CommunicationChannel = 'email' | 'work_phone' | 'online';

const CHANNEL_META: Record<CommunicationChannel, { label: string; hint: string; accent: string }> = {
  email: { label: '邮件', hint: '自然语言邮件 · 1 行动点', accent: 'text-blue-700 bg-blue-50 border-blue-200' },
  work_phone: { label: '电话', hint: '可能未接 · 1 行动点', accent: 'text-violet-700 bg-violet-50 border-violet-200' },
  online: { label: '微信', hint: '需先申请添加 · 1 行动点', accent: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
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
  { type: 'visit_preparation', title: '拜访前准备', minutes: 0, cost: 3, description: '完全由你思考并写明要准备的内容' },
] as const;

const PHASE_GUIDANCE = [
  { goal: '建立触点、了解项目', hint: '先选择一位人物搜集公开资料，再带着明确目标联系对方。' },
  { goal: '补全决策链', hint: '核实谁影响流程、谁能推动落地，不要只停留在表面关系。' },
  { goal: '关键人攻坚', hint: '把已知事实转化为针对性问题和有效拜访。' },
  { goal: '方案验证与异议处理', hint: '用证据回应客户价值、竞品比较和实施风险。' },
  { goal: '决策闭环', hint: '检查承诺、待办、风险和关键人物支持，再决定是否提交。' },
] as const;

const COMPETITIVE_POSITION_META = {
  lagging: { label: '我方暂时落后', tone: 'border-red-200 bg-red-50 text-red-700' },
  close: { label: '双方态势接近', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
  leading: { label: '我方暂时领先', tone: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
} as const;

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
      approach: ['drop_by', 'drop_in'].includes(firstString(item, ['approach', 'invitationMethod', 'travelMode', 'invitationMode'])) ? 'drop_by' as const : 'dedicated' as const,
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
    const brief = firstRecord(item, ['brief']);
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
      brief: brief ? {
        audience: firstString(brief, ['audience']),
        problem: firstString(brief, ['problem']),
        dimensions: firstString(brief, ['dimensions']),
        evidence: firstString(brief, ['evidence']),
        nextStep: firstString(brief, ['nextStep']),
      } : undefined,
    };
  }).filter((item) => isCurrentPreparationType(item.type));
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
      revisionCount: firstNumber(item, ['revisionCount'], 0),
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
  if (type === 'research_public_info') return '人物公开信息已整理';
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
  const multiplayerRoomId = params.get('roomId') || '';
  const requestedSessionId = params.get('sessionId') || '';
  const scene = SCENE_INFO[location] ?? SCENE_INFO['project-1'];
  const [messages, setMessages] = useState<Message[]>([]);
  const [gameSessionId, setGameSessionId] = useState('');
  const [gameState, setGameState] = useState<GameRuntimeState | null>(null);
  const [savePickerReady, setSavePickerReady] = useState(false);
  const [activeSaves, setActiveSaves] = useState<GameSaveView[]>([]);
  const [savePickerError, setSavePickerError] = useState('');
  const [loadingSave, setLoadingSave] = useState(false);
  const [npcs, setNpcs] = useState<NpcProfile[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorProfile[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<string | null>(null);
  const [phoneTab, setPhoneTab] = useState<PhoneTab>('contacts');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('conversation');
  const [communicationChannel, setCommunicationChannel] = useState<CommunicationChannel>('email');
  const [phoneCallActive, setPhoneCallActive] = useState(false);
  const [actionNpcId, setActionNpcId] = useState<string | null>(null);
  const [publicInfoNpcId, setPublicInfoNpcId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [commandBusy, setCommandBusy] = useState<string | null>(null);
  const [commandFeedback, setCommandFeedback] = useState('');
  const [showResourceDetails, setShowResourceDetails] = useState(false);
  const [showCompetitors, setShowCompetitors] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [preparationType] = useState<(typeof PREPARATION_OPTIONS)[number]['type']>('visit_preparation');
  const [preparationText, setPreparationText] = useState('');
  const [preparationAppointmentId, setPreparationAppointmentId] = useState('');
  const [emailAttachmentIds, setEmailAttachmentIds] = useState<string[]>([]);
  const [publicInfoRecord, setPublicInfoRecord] = useState<GamePublicResearchRecord | undefined>();
  const [invitationResult, setInvitationResult] = useState<InvitationResultView | null>(null);
  const [showEndDayCheck, setShowEndDayCheck] = useState(false);
  const [showSubmissionCheck, setShowSubmissionCheck] = useState(false);
  const [competitorEvent, setCompetitorEvent] = useState<CompetitorActionRecord | null>(null);
  const [minutesDraft, setMinutesDraft] = useState<MeetingMinutesDraft | null>(null);
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
  const offlineMessages = messages.filter((message) => message.channel === 'offline');
  const latestNpcMeetingMessage = [...offlineMessages].reverse().find((message) => message.role === 'assistant');
  const latestPlayerMeetingMessage = [...offlineMessages].reverse().find((message) => message.role === 'user');
  const selectedProfile = npcs.find((npc) => npc.id === selectedNpc) ?? null;
  const selectedContact = selectedNpc ? gameState?.npcContacts?.[selectedNpc] : undefined;
  const unreadCount = notifications.filter((item) => !item.read).length;
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
  const competitorMeta = COMPETITIVE_POSITION_META[gameState?.competitorState?.position ?? 'close'];
  const todayUnfinishedAppointments = appointments.filter((item) => item.stage === round && ['pending', 'accepted', 'countered'].includes(item.status));
  const unreadFollowUps = notifications.filter((item) => !item.read && item.target === 'follow_up');
  const submissionWarnings = [
    !gameState?.unlockedClues?.includes('decision_process') ? '尚未核实完整决策链' : '',
    meetingMinutes.length === 0 ? '尚未完成任何线下拜访' : '',
    gameState?.complianceRisks?.some((risk) => risk.status === 'latent' || risk.status === 'triggered') ? '存在未消除的合规风险' : '',
  ].filter(Boolean);

  const applyServerState = (nextState: GameRuntimeState) => {
    setGameState(nextState);
  };

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('weixun_session') || '';
    const headers = { 'Content-Type': 'application/json', 'x-session': token };
    const storageKey = `game-session:${location}`;
    const projectId = location.replace('project-', '');

    const bootstrap = async () => {
      if (requestedSessionId) {
        await openSave(requestedSessionId, true);
        return;
      }
      const saveResponse = await fetch(`/api/game/sessions?scenarioCode=${encodeURIComponent(location)}`, { headers });
      const saveData = await saveResponse.json().catch(() => null);
      if (!saveResponse.ok) throw new Error(saveData?.error || '存档列表加载失败');
      if (!cancelled) {
        setActiveSaves(Array.isArray(saveData?.saves) ? saveData.saves : []);
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
      const npcResponse = await fetch(`/api/game-data/npcs?project_id=${projectId}&game_session_id=${restored!.id}`, { headers });
      if (!npcResponse.ok) throw new Error('NPC加载失败');
      const npcData = await npcResponse.json();
      const loaded: NpcProfile[] = Array.isArray(npcData.data) ? npcData.data : [];
      if (cancelled) return;
      setNpcs(loaded);
      setSelectedNpc(restored!.state.activeMeeting?.npcId ?? loaded[0]?.id ?? null);
    };

    bootstrap().catch((error) => {
      if (cancelled) return;
      const code = error instanceof Error ? error.message : '对局初始化失败';
      setSavePickerError(code === 'SAVE_LIST_UNAVAILABLE'
        ? '数据库暂时无法连接，当前存档尚未加载。请检查网络或 Supabase 配置后重试。'
        : code);
      setSavePickerReady(true);
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
    const preferred = selectedContact?.initialChannel;
    setCommunicationChannel(preferred === 'work_phone' ? 'work_phone' : 'email');
  }, [activeMeeting, selectedContact?.initialChannel, selectedContact?.status]);

  useEffect(() => {
    setEmailAttachmentIds([]);
  }, [selectedNpc]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (typewriterTimerRef.current !== null) window.clearInterval(typewriterTimerRef.current);
    typewriterQueueRef.current = [];
  }, []);

  const openSave = async (sessionId: string, trackContinue = false) => {
    setLoadingSave(true);
    setSavePickerError('');
    try {
      const headers = { 'Content-Type': 'application/json', 'x-session': localStorage.getItem('weixun_session') || '' };
      const response = await fetch(`/api/game/sessions/${sessionId}${trackContinue ? '?entry=continue' : ''}`, { headers });
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
      setNpcs(loaded);
      setSelectedNpc(restored.state.activeMeeting?.npcId ?? loaded[0]?.id ?? null);
    } catch (error) {
      setSavePickerError(error instanceof Error ? error.message : '存档读取失败');
    } finally {
      setLoadingSave(false);
    }
  };

  const startNewGame = async () => {
    const replacing = activeSaves.length > 0;
    if (replacing && !window.confirm('开始新游戏会永久覆盖当前进度，原存档无法恢复。确定继续吗？')) return;
    setLoadingSave(true);
    setSavePickerError('');
    try {
      const headers = { 'Content-Type': 'application/json', 'x-session': localStorage.getItem('weixun_session') || '' };
      const response = await fetch('/api/game/sessions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ scenarioCode: location, replaceExisting: replacing }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.gameSession) throw new Error(
        data?.error === 'SAVE_REPLACE_FAILED'
          ? '新存档创建失败，原存档已保留，请稍后重试'
          : data?.error === 'SAVE_LIMIT_REACHED'
            ? '已有进行中的对局，请确认覆盖后重试'
            : data?.error || '新游戏创建失败',
      );
      await openSave(data.gameSession.id);
    } catch (error) {
      setSavePickerError(error instanceof Error ? error.message : '新游戏创建失败');
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
      if (type === 'invite' && nextState) {
        const result = asRecord(data?.result);
        const appointmentId = firstString(firstRecord(result, ['appointment']), ['id', 'appointmentId']);
        const appointment = getAppointments(nextState).find((item) => item.id === appointmentId);
        if (appointment && selectedProfile) {
          const feedback = [...getNotifications(nextState)].reverse().find((item) => item.npcId === selectedProfile.id)?.body
            ?? commandResultMessage(type, data?.result);
          setInvitationResult({ appointment, npcName: selectedProfile.name, npcTitle: selectedProfile.title, feedback });
        }
      }
      if (type === 'advance_phase') {
        if (nextState?.submissionReady) setShowSubmissionCheck(true);
      }
      if (type === 'research_public_info') {
        const record = firstRecord(asRecord(data?.result), ['publicResearch']);
        if (record) setPublicInfoRecord(record as unknown as GamePublicResearchRecord);
      }
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
    communication?: { intent?: 'outreach' | 'message' | 'call_connect'; channel?: Message['channel']; hidePlayerMessage?: boolean },
  ) => {
    if (!content.trim() || streaming || !selectedNpc || !gameSessionId || !gameState) return;
    const contact = gameState.npcContacts?.[selectedNpc];
    const intent = communication?.intent ?? (contact?.status === 'known' ? 'outreach' : 'message');
    const channel: Message['channel'] = communication?.channel ?? (activeMeeting?.npcId === selectedNpc
      ? 'offline'
      : communicationChannel);
    const attachmentIds = channel === 'email' ? emailAttachmentIds : [];
    const chatSignature = `${selectedNpc}:${intent}:${channel}:${gameState.version}:${content.trim()}:${attachmentIds.join(',')}`;
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
          attachmentIds,
          usedPreparationIds: deliveredPreparationIds,
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
              if (event.invitation === true) {
                const appointmentRecord = asRecord(event.appointment);
                const appointmentId = firstString(appointmentRecord, ['id', 'appointmentId']);
                const appointment = getAppointments(event.state).find((item) => item.id === appointmentId);
                const profile = npcs.find((npc) => npc.id === selectedNpc);
                if (appointment && profile) {
                  const feedback = typeof event.reply === 'string' && event.reply.trim()
                    ? event.reply
                    : [...getNotifications(event.state)].reverse().find((item) => item.npcId === selectedNpc)?.body ?? '邀约结果已记录。';
                  setInvitationResult({ appointment, npcName: profile.name, npcTitle: profile.title, feedback });
                }
              }
              if (channel === 'email' && attachmentIds.length > 0) setEmailAttachmentIds([]);
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

  const finishStage = async () => {
    setShowEndDayCheck(false);
    if (gameState?.gameMode === 'multiplayer' && multiplayerRoomId) {
      try {
        const response = await fetch(`/api/multiplayer/rooms/${multiplayerRoomId}/ready`, { method: 'POST', headers: { 'x-session': localStorage.getItem('weixun_session') || '' } });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || '阶段确认失败');
        setCommandFeedback(data?.advanced ? '全体已确认，房间已进入下一阶段，请刷新同步。' : '已确认结束，等待其他公司。');
      } catch (error) {
        alert(error instanceof Error ? error.message : '阶段确认失败');
      }
      return;
    }
    await runCommand('advance_phase');
  };

  const submitPreparation = async () => {
    if (!selectedNpc) return;
    if (preparationText.trim().length < 10) {
      setCommandFeedback('请用自然语言写明你的拜访前准备，至少 10 个字。');
      return;
    }
    const success = await runCommand('prepare', {
      npcId: selectedNpc,
      appointmentId: preparationAppointmentId || undefined,
      preparationType,
      type: preparationType,
      title: '拜访前准备',
      content: preparationText,
    });
    if (success) {
      setPreparationText('');
      setWorkspaceMode('conversation');
    }
  };

  const openMinutesEditor = (minutes: MeetingMinutesView) => setMinutesDraft({
    id: minutes.id,
    summary: minutes.summary,
    confirmedItems: minutes.confirmedItems.join('；'),
    npcCommitments: minutes.npcCommitments.join('；'),
    playerCommitments: minutes.playerCommitments.join('；'),
    nextStep: minutes.nextStep,
  });

  const saveMeetingMinutes = async () => {
    if (!minutesDraft) return;
    const splitItems = (value: string) => value.split(/[\n；;]/).map((item) => item.trim()).filter(Boolean);
    const success = await runCommand('update_meeting_minutes', {
      minutesId: minutesDraft.id,
      summary: minutesDraft.summary,
      confirmedItems: splitItems(minutesDraft.confirmedItems),
      npcCommitments: splitItems(minutesDraft.npcCommitments),
      playerCommitments: splitItems(minutesDraft.playerCommitments),
      nextStep: minutesDraft.nextStep,
    });
    if (success) setMinutesDraft(null);
  };

  const selectedNpcName = selectedProfile?.name ?? '联系人';
  const openOrResearchPublicInfo = async (npcId: string) => {
    setActionNpcId(null);
    setPublicInfoRecord(undefined);
    const success = await runCommand('research_public_info', { npcId });
    if (success) setPublicInfoNpcId(npcId);
  };

  return (
    <div className="min-h-screen bg-[#EEF2F7] text-slate-900 flex flex-col">
      <header className="border-b border-slate-800 bg-[#0B1736] px-4 py-3 text-white shadow-lg lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-950/30"><Building2 className="h-4 w-4" /></div>
            <div>
              <div className="text-sm font-bold">{scene.name}</div>
              <div className="text-[11px] text-slate-300">销售作战台 · 难度 {'★'.repeat(scene.difficulty)}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs backdrop-blur">
            <span className="font-semibold text-blue-200">第{round}阶段 · {getPhaseName(round)}</span>
            <span className="text-white/20">|</span>
            <span className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-amber-500" />行动点 <strong>{coins}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowEndDayCheck(true)} disabled={Boolean(commandBusy) || streaming || Boolean(activeMeeting) || Boolean(gameState?.submissionReady)} className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40">{round < 5 ? '结束本阶段' : '进入提交检查'}</button>
            <button onClick={() => setShowSubmissionCheck(true)} disabled={Boolean(commandBusy) || streaming || Boolean(activeMeeting)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40">提交项目</button>
          </div>
        </div>
        {nextAppointment && (
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-300">
            <CalendarClock className="h-3.5 w-3.5 text-blue-300" />
            可执行拜访：{npcs.find((npc) => npc.id === nextAppointment.npcId)?.name ?? '联系人'} · {VISIT_LABELS[nextAppointment.visitType]}
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[260px_370px_minmax(500px,1fr)]">
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
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="text-[10px] font-semibold tracking-[0.16em] text-blue-600">本阶段建议目标</div>
            <div className="mt-1 text-sm font-bold text-blue-950">{PHASE_GUIDANCE[Math.min(round, 5) - 1].goal}</div>
            <p className="mt-2 text-[11px] leading-5 text-blue-800">{PHASE_GUIDANCE[Math.min(round, 5) - 1].hint}</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <button onClick={() => setShowResourceDetails((value) => !value)} className="flex w-full items-center justify-between text-left text-xs font-bold">
              <span className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-blue-600" />资源明细</span>
              <ChevronRight className={`h-4 w-4 transition ${showResourceDetails ? 'rotate-90' : ''}`} />
            </button>
            {showResourceDetails && (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <div className="flex justify-between"><span>资源限制</span><strong>仅行动点</strong></div>
                <div className="flex justify-between"><span>累计消耗行动点</span><strong>{simulation.totalSpent}</strong></div>
              </div>
            )}
          </section>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
            <span className="flex items-center gap-2 text-xs font-bold"><Users className="h-4 w-4 text-blue-600" />竞品情报</span>
            <span className="mt-2 block text-[11px] leading-5 text-slate-500">竞品推进状态不可直接查看，只能在与客户沟通时询问并自行判断真伪。</span>
          </div>
        </aside>

        <section className="relative flex min-h-[680px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <div><div className="text-base font-bold">客户关系</div><div className="text-[10px] text-slate-500">联系人、回执与行动记录</div></div>
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
                    <div key={npc.id} className={`overflow-hidden rounded-2xl border transition ${selectedNpc === npc.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-200'} ${activeMeeting && activeMeeting.npcId !== npc.id ? 'opacity-40' : ''}`}>
                      <button onClick={() => openContact(npc.id)} disabled={Boolean(activeMeeting && activeMeeting.npcId !== npc.id)} className="flex w-full items-center gap-3 p-3 text-left disabled:cursor-not-allowed">
                        <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full ${contacted ? 'bg-gradient-to-br from-blue-500 to-indigo-700 text-lg font-bold text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {contacted ? npc.name.slice(0, 1) : <UserRound className="h-6 w-6" />}
                          {unread > 0 && <span className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white bg-red-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-bold">{npc.name}</span><MoreHorizontal className="h-4 w-4 text-slate-400" /></div>
                          <div className="truncate text-[11px] text-slate-500">{npc.title}</div>
                          <div className="mt-1 text-[10px] text-slate-400">{contacted ? '已建立接触' : '尚未有效接触'}</div>
                        </div>
                      </button>
                      <button onClick={() => void openOrResearchPublicInfo(npc.id)} disabled={Boolean(commandBusy) || Boolean(activeMeeting)} className="flex w-full items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2 text-left text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">
                        <span className="flex items-center gap-1.5"><Search className="h-3.5 w-3.5" />搜索人物公开信息</span>
                        <span>2 行动点</span>
                      </button>
                    </div>
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
                        <div className="mt-1 text-[10px] text-slate-500">{VISIT_LABELS[appointment.visitType]} · 接受后本阶段直接执行</div>
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
          {actionNpcId && phoneTab === 'contacts' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]" onClick={() => setActionNpcId(null)}>
              <div className="w-full max-w-[330px] rounded-2xl border border-white/70 bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,.28)]" onClick={(event) => event.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between"><div><div className="text-base font-bold">{npcs.find((npc) => npc.id === actionNpcId)?.name}</div><div className="mt-0.5 text-[11px] text-slate-500">选择下一步行动</div></div><button onClick={() => setActionNpcId(null)} aria-label="关闭行动选择" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-4 w-4" /></button></div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setSelectedNpc(actionNpcId); setCommunicationChannel('email'); setWorkspaceMode('conversation'); setActionNpcId(null); }} className="rounded-xl bg-blue-50 p-3 text-center text-[11px] font-semibold text-blue-700 hover:bg-blue-100"><Mail className="mx-auto mb-1.5 h-5 w-5" />电话 / 邮件</button>
                  <button onClick={async () => { const ok = await runCommand('request_wechat', { npcId: actionNpcId, message: '您好，我是本项目的供应商联系人，希望添加您的工作微信，方便后续沟通。' }); if (ok) setActionNpcId(null); }} disabled={Boolean(commandBusy) || gameState?.npcContacts[actionNpcId]?.status === 'known' || gameState?.npcContacts[actionNpcId]?.status === 'online'} className="rounded-xl bg-emerald-50 p-3 text-center text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"><MessageCircle className="mx-auto mb-1.5 h-5 w-5" />申请工作微信</button>
                  <button onClick={() => void openOrResearchPublicInfo(actionNpcId)} disabled={Boolean(commandBusy) || Boolean(activeMeeting)} className="rounded-xl bg-violet-50 p-3 text-center text-[11px] font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40"><Search className="mx-auto mb-1.5 h-5 w-5" />搜索公开信息</button>
                  <button onClick={() => { setSelectedNpc(actionNpcId); setWorkspaceMode('preparation'); setActionNpcId(null); }} disabled={Boolean(activeMeeting)} className="rounded-xl bg-amber-50 p-3 text-center text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"><FileText className="mx-auto mb-1.5 h-5 w-5" />拜访准备</button>
                </div>
              </div>
            </div>
          )}
        </section>

        <main className="flex min-h-[680px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full ${selectedNpc && hasContacted(selectedNpc) ? 'bg-gradient-to-br from-blue-500 to-indigo-700 font-bold text-white' : 'bg-slate-200 text-slate-500'}`}>{selectedNpc && hasContacted(selectedNpc) ? selectedNpcName.slice(0, 1) : <UserRound className="h-5 w-5" />}</div>
              <div><div className="text-sm font-bold">{selectedNpcName}</div><div className="text-[11px] text-slate-500">{selectedProfile?.title ?? '请在客户关系栏选择联系人'}{selectedContact ? ` · ${selectedContact.status === 'known' ? '待建联' : '已建立联系'}` : ''}</div></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeMeeting?.npcId === selectedNpc && <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700">{VISIT_LABELS[activeMeeting.visitType]} · {activeMeeting.turnCount}/{activeMeeting.maxTurns}轮</span>}
              {selectedNpc && latestCompletedAppointment && !activeMeeting && <button onClick={() => setWorkspaceMode('follow_up')} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">会后待办</button>}
              {selectedNpc && <button onClick={() => setWorkspaceMode('preparation')} disabled={Boolean(activeMeeting)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">准备</button>}
            </div>
          </div>

          {workspaceMode === 'preparation' && selectedNpc && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-2xl">
                <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">为 {selectedNpcName} 做拜访前准备</h2><p className="mt-1 text-xs text-slate-500">不提供准备类型，请自行思考需要准备什么并完整写出。</p></div><button onClick={() => setWorkspaceMode('conversation')} className="rounded-lg border border-slate-200 p-2"><X className="h-4 w-4" /></button></div>
                <div className="space-y-2">
                  {PREPARATION_OPTIONS.map((option) => (
                    <div key={option.type} className="flex w-full items-center gap-3 rounded-xl border border-blue-400 bg-blue-50 p-4 text-left">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><FileText className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1"><div className="text-sm font-bold">{option.title}</div><div className="mt-1 text-[11px] text-slate-500">{option.description}</div></div>
                      <div className="text-right text-[10px] text-slate-500"><div>{option.cost}行动点</div></div>
                    </div>
                  ))}
                </div>
                {selectedAppointments.length > 0 && <Field label="绑定拜访（可选）"><select value={preparationAppointmentId} onChange={(event) => setPreparationAppointmentId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400"><option value="">作为通用准备</option>{selectedAppointments.filter((item) => ['pending', 'accepted', 'countered'].includes(item.status)).map((item) => <option key={item.id} value={item.id}>{VISIT_LABELS[item.visitType]} · {item.location}</option>)}</select></Field>}
                <Field label="你的拜访前准备"><textarea value={preparationText} onChange={(event) => setPreparationText(event.target.value)} rows={10} placeholder="请自行写明你准备了哪些信息、材料、案例、问题、证据或其他事项，以及为什么这样准备。" className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-blue-400" /></Field>
                <button onClick={submitPreparation} disabled={Boolean(commandBusy) || preparationText.trim().length < 10} className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{commandBusy === 'prepare' ? '准备中...' : '确认准备'}</button>
              </div>
            </div>
          )}

          {workspaceMode === 'follow_up' && selectedNpc && latestCompletedAppointment && (
            <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
              <div className="mx-auto max-w-2xl">
                <div className="mb-5 flex items-center justify-between"><div><div className="text-xs font-semibold tracking-[0.16em] text-violet-600">VISIT FOLLOW-UP</div><h2 className="mt-1 text-xl font-bold text-slate-900">与 {selectedNpcName} 的会后待办</h2><p className="mt-1 text-xs text-slate-500">先确认纪要，再选择需要兑现的动作；联系尝试只消耗行动点。</p></div><button onClick={() => setWorkspaceMode('conversation')} className="rounded-lg border border-slate-200 bg-white p-2"><X className="h-4 w-4" /></button></div>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><div className="text-sm font-bold">拜访纪要</div>{Boolean(latestSelectedMinutes?.revisionCount) && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">已修订 {latestSelectedMinutes?.revisionCount} 次</span>}</div>
                    <div className="flex items-center gap-2"><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">{VISIT_LABELS[latestCompletedAppointment.visitType]}</span>{latestSelectedMinutes && <button onClick={() => openMinutesEditor(latestSelectedMinutes)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50">纠正纪要</button>}</div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{latestSelectedMinutes?.summary || '本次拜访已完成，请根据约定安排后续。'}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3 text-xs"><strong className="text-slate-700">客户承诺</strong><p className="mt-1 leading-5 text-slate-500">{latestSelectedMinutes?.npcCommitments.join('；') || '暂无明确承诺'}</p></div><div className="rounded-xl bg-slate-50 p-3 text-xs"><strong className="text-slate-700">我方承诺</strong><p className="mt-1 leading-5 text-slate-500">{latestSelectedMinutes?.playerCommitments.join('；') || '确认下一步沟通安排'}</p></div></div>
                </section>
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
                    <div className="flex items-center gap-2 text-xs"><MapPin className="h-4 w-4 text-emerald-700" /><strong>{VISIT_LABELS[activeMeeting.visitType]}</strong><span className="text-emerald-800">对话上限 {activeMeeting.maxTurns}轮</span></div>
                    <button onClick={() => runCommand('end_visit', { appointmentId: activeMeeting.appointmentId, reason: 'player', summary: '' })} disabled={Boolean(commandBusy) || streaming} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-800 disabled:opacity-40">结束拜访</button>
                  </div>
                  {activeMeeting.visitType === 'informal' && activeMeeting.workTopicOpenedBy !== 'npc' && <div className="mt-2 text-[11px] text-amber-800">当前是非正式交流，建议先聊生活与兴趣，等待对方自然谈到工作。</div>}
                  {activeMeeting.turnCount === activeMeeting.maxTurns - 1 && <div className="mt-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-[11px] font-semibold text-amber-900">只剩最后一轮对话，请优先确认结论、双方承诺和下一步。</div>}
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
                      <div><strong>对方提出前置条件</strong><span className="ml-2 text-slate-600">{appointment.location}</span>{appointment.conditions.length > 0 && <div className="mt-1 text-[10px] text-amber-800">条件：{appointment.conditions.join('；')}</div>}</div>
                      <div className="flex gap-2"><button onClick={() => runCommand('update_appointment', { appointmentId: appointment.id, action: 'cancel' })} disabled={Boolean(commandBusy)} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold disabled:opacity-40">取消</button><button onClick={() => runCommand('update_appointment', { appointmentId: appointment.id, action: 'accept_counter' })} disabled={Boolean(commandBusy)} className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white disabled:opacity-40">接受改期</button></div>
                    </div>
                  ))}
                </div>
              )}
              {selectedAppointments.some((item) => item.status === 'accepted') && !activeMeeting && (
                <div className="border-b border-blue-100 bg-blue-50 px-5 py-3">
                  {selectedAppointments.filter((item) => item.status === 'accepted').map((appointment) => (
                    <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div><strong>{VISIT_LABELS[appointment.visitType]}</strong><span className="ml-2 text-slate-600">本阶段可执行 · {appointment.location}</span></div>
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
                  <div className="absolute inset-0 bg-cover bg-center opacity-95" style={{ backgroundImage: "url('/images/game/visit-meeting-room-empty-v1.png')" }} />
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-transparent to-slate-950/90" />
                  <div className="relative flex h-full min-h-[560px] flex-col justify-between p-5">
                    <div className="flex items-start justify-between gap-4 text-white">
                      <div><div className="text-xs font-semibold tracking-[0.22em] text-amber-200">线下拜访现场</div><h2 className="mt-1 text-xl font-bold">{selectedAppointments.find((item) => item.id === activeMeeting.appointmentId)?.location || '客户会面场景'}</h2><p className="mt-1 text-xs text-white/75">{VISIT_LABELS[activeMeeting.visitType]} · 第 {activeMeeting.turnCount}/{activeMeeting.maxTurns} 轮</p></div>
                      <div className="rounded-full bg-slate-950/55 px-3 py-2 text-xs text-white/85 backdrop-blur">正在会面 · {selectedNpcName}</div>
                    </div>
                    <div className="mx-auto w-full max-w-4xl space-y-3">
                      {latestNpcMeetingMessage && (
                        <div key={latestNpcMeetingMessage.ts} className="flex items-end gap-3 rounded-2xl border border-white/25 bg-slate-950/72 p-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-300">
                          <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl border border-white/30 bg-slate-800 shadow-lg sm:h-40 sm:w-32">
                            <Image src={latestNpcMeetingMessage.content ? '/emotion-greeting.jpeg' : '/emotion-thinking.jpeg'} alt={`${selectedNpcName}的形象`} fill sizes="128px" className="object-cover object-top" priority />
                          </div>
                          <div className="min-w-0 flex-1 rounded-2xl rounded-bl-sm bg-white p-4 text-slate-900 shadow-lg">
                            <div className="mb-1.5 text-xs font-bold text-amber-700">{selectedNpcName} · {selectedProfile?.title}</div>
                            <p className="whitespace-pre-wrap text-sm leading-6 sm:text-base">{latestNpcMeetingMessage.content || (streaming ? '正在思考…' : '')}</p>
                          </div>
                        </div>
                      )}
                      {!latestNpcMeetingMessage && <div className="rounded-xl bg-slate-950/55 px-4 py-3 text-center text-sm text-white/90 backdrop-blur">面谈开始。现场暂时只呈现环境，对方发言时人物形象与台词会同步出现。</div>}
                      {latestPlayerMeetingMessage && <div className="ml-auto max-w-2xl rounded-xl border border-white/15 bg-slate-950/55 px-4 py-2 text-xs leading-5 text-white/80 backdrop-blur"><strong className="text-blue-200">你刚刚说：</strong>{latestPlayerMeetingMessage.content}</div>}
                      <div className="flex items-end gap-2 rounded-2xl border border-white/20 bg-slate-950/65 p-3 shadow-2xl backdrop-blur-md"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(input); } }} disabled={streaming} rows={2} placeholder="输入你在现场说的话…" className="min-h-[56px] flex-1 resize-none rounded-xl border border-white/20 bg-white/95 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-300" /><button onClick={() => sendMessage(input)} disabled={streaming || !input.trim()} className="rounded-xl bg-amber-400 p-3 text-slate-900 disabled:opacity-40"><Send className="h-4 w-4" /></button></div>
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
              <div className={`h-[430px] shrink-0 overflow-y-auto p-5 ${activeMeeting ? 'hidden' : communicationChannel === 'email' ? 'bg-slate-100' : 'bg-slate-950'}`}>
                {selectedNpc && !activeMeeting && <div className={`mx-auto mb-4 max-w-2xl rounded-2xl border p-4 shadow-sm ${communicationChannel === 'email' ? 'border-slate-200 bg-white text-slate-800' : 'border-violet-200 bg-gradient-to-r from-violet-700 to-indigo-700 text-white'}`}><div className="flex items-center gap-2 text-sm font-bold">{communicationChannel === 'email' ? <Mail className="h-4 w-4" /> : communicationChannel === 'online' ? <MessageCircle className="h-4 w-4" /> : <Phone className="h-4 w-4" />}{communicationChannel === 'email' ? `写给 ${selectedNpcName} 的邮件` : communicationChannel === 'online' ? `与 ${selectedNpcName} 的微信` : `与 ${selectedNpcName} 的工作电话`}</div><div className={`mt-1 text-[11px] ${communicationChannel === 'email' ? 'text-slate-400' : 'text-white/70'}`}>{communicationChannel === 'email' ? '收件人：客户联系人　主题：项目沟通' : communicationChannel === 'online' ? '通过工作微信自然沟通' : '请在关键事实与结论上保持简洁'}</div></div>}
                {!selectedNpc && <EmptyPhoneState icon={Users} title="选择一位联系人" description="从左侧客户关系栏选择人物，再通过电话、邮件或微信自然沟通，必要时提出拜访并准备材料。" />}
              {selectedNpc && !activeMeeting && communicationChannel === 'work_phone' && <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center text-white"><div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-4xl font-bold shadow-[0_0_50px_rgba(168,85,247,.55)]">{selectedNpcName.slice(0, 1)}</div><h3 className="mt-5 text-xl font-bold">{selectedNpcName}</h3><p className="mt-1 text-sm text-violet-200">{phoneCallActive ? (streaming ? '正在接通…' : '通话已接通') : '准备拨打工作电话'}</p>{phoneCallActive ? <div className="mt-7 w-full rounded-2xl bg-white/10 p-4 text-left"><div className="mb-2 text-xs text-violet-200">本次通话记录</div><div className="max-h-28 space-y-2 overflow-y-auto text-sm">{visibleChannelMessages.filter((message) => message.content !== '[电话呼出]').slice(-3).map((message) => <p key={message.ts} className="leading-5"><strong>{message.role === 'user' ? '我：' : `${selectedNpcName}：`}</strong>{message.content || (streaming ? '…' : '')}</p>)}</div></div> : <button onClick={() => { setPhoneCallActive(true); void sendMessage('[电话呼出]', { intent: 'call_connect', channel: 'work_phone', hidePlayerMessage: true }); }} disabled={!selectedNpc || streaming} className="mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-400 disabled:opacity-40"><Phone className="h-6 w-6" /></button>}</div>}
                {selectedNpc && !activeMeeting && communicationChannel !== 'work_phone' && visibleChannelMessages.length === 0 && <div className="mx-auto mt-12 max-w-sm rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center"><MessageCircle className="mx-auto h-8 w-8 text-blue-500" /><div className="mt-3 text-sm font-bold">开始与 {selectedNpcName} 沟通</div><div className="mt-2 text-xs leading-5 text-slate-500">对方的真实态度不会直接显示，请留意措辞、回复节奏与后续行动。</div></div>}
                {selectedNpc && !activeMeeting && communicationChannel === 'email' && <div className="mx-auto max-w-2xl space-y-3">{visibleChannelMessages.map((message) => <article key={message.ts} className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-4 py-2 text-[11px] text-slate-500"><div><strong className="text-slate-800">{message.role === 'user' ? '我方' : selectedNpcName}</strong>　收件人：{message.role === 'user' ? selectedNpcName : '我方'}</div><div className="mt-1">主题：项目沟通　·　{formatMessageTime(message.ts)}</div></div><p className="whitespace-pre-wrap px-4 py-3 text-sm leading-6 text-slate-800">{message.content || (streaming ? '正在发送…' : '')}</p></article>)}</div>}
                <div ref={messagesEndRef} />
              </div>
              <div className={`border-t border-slate-200 bg-white p-4 ${activeMeeting ? 'hidden' : ''}`}>
                {commandFeedback && <div className="mb-2 flex items-center gap-1.5 text-[11px] text-emerald-700"><Check className="h-3.5 w-3.5" />{commandFeedback}</div>}
                {communicationChannel === 'email' && selectedPreparations.some((item) => item.status === 'ready' && !item.type.includes('gift')) && <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 p-3"><div className="text-[11px] font-semibold text-blue-900">邮件附件（可多选）</div><div className="mt-2 flex flex-wrap gap-2">{selectedPreparations.filter((item) => item.status === 'ready' && !item.type.includes('gift')).map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-[11px] text-blue-900"><input type="checkbox" checked={emailAttachmentIds.includes(item.id)} onChange={(event) => setEmailAttachmentIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} disabled={streaming} />{item.title}</label>)}</div><div className="mt-2 text-[10px] text-blue-700">发送后会按本次邮件提交并记录所选准备材料。</div></div>}
                {communicationChannel === 'work_phone' && !phoneCallActive ? <div className="flex items-center justify-between rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-900"><span>点击上方绿色按钮拨打电话；接通后可输入通话要点。</span><Phone className="h-4 w-4" /></div> : <div className="flex items-end gap-2">
                  <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(input); } }} disabled={!selectedNpc || streaming} rows={3} placeholder={selectedContact?.status === 'known' ? '输入首次建联内容…' : communicationChannel === 'email' ? '撰写邮件正文…' : communicationChannel === 'online' ? '输入微信消息…' : '输入电话话术…'} className="min-h-[76px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-100" />
                  <button onClick={toggleRecording} disabled={!selectedNpc || streaming} className={`rounded-xl border p-3 ${isRecording ? 'border-red-300 bg-red-50 text-red-600' : 'border-slate-200 text-slate-500'}`}>{isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button>
                  <button onClick={() => sendMessage(input)} disabled={!selectedNpc || streaming || !input.trim()} className="rounded-xl bg-blue-600 p-3 text-white disabled:opacity-40"><Send className="h-4 w-4" /></button>
                </div>}
                <div className="mt-2 text-[10px] text-slate-400">邮件、电话和微信尝试均按行动点结算；电话可能无人接听。</div>
              </div>
            </>
          )}
        </main>
      </div>

      {!gameState && savePickerReady && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
            <div className="bg-[#0B1736] px-8 py-7 text-white"><div className="text-xs font-semibold tracking-[0.2em] text-blue-300">SALES SIMULATION</div><h1 className="mt-2 text-2xl font-bold">进入项目作战台</h1><p className="mt-2 text-sm text-slate-300">每位玩家只保留一个进行中的项目存档。</p></div>
            <div className="p-7">
              {activeSaves[0] ? <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-wider text-slate-400">当前进度</div><div className="mt-2 text-base font-bold text-slate-900">{getPhaseName(activeSaves[0].currentRound)}</div><div className="mt-1 text-xs text-slate-500">第 {activeSaves[0].currentRound} / {activeSaves[0].maxRounds} 阶段 · 最近保存 {new Date(activeSaves[0].updatedAt).toLocaleString('zh-CN')}</div></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">可继续</span></div></div> : <div className="mb-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-7 text-center text-sm text-slate-500">还没有进行中的项目，请开始新游戏。</div>}
              {savePickerError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{savePickerError}</div>}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button onClick={() => activeSaves[0] && void openSave(activeSaves[0].id, true)} disabled={loadingSave || !activeSaves[0]} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight className="h-4 w-4" />继续游戏</button>
                <button onClick={() => void startNewGame()} disabled={loadingSave} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Play className="h-4 w-4" />开始新游戏</button>
              </div>
              {activeSaves[0] && <p className="mt-3 text-center text-[11px] text-amber-700">开始新游戏会先要求确认，确认后覆盖当前存档。</p>}
            </div>
          </div>
        </div>
      )}

      {showCompetitors && (
        <Modal title="竞品实时竞争情况" onClose={() => setShowCompetitors(false)}>
          <div className={`rounded-xl border p-4 ${competitorMeta.tone}`}><div className="text-xs font-semibold">当前模糊态势</div><div className="mt-1 text-lg font-bold">{competitorMeta.label}</div><p className="mt-2 text-xs leading-5">这是根据已发生事件的区间判断，对局结束前不显示竞品精确分数。</p></div>
          <section className="mt-4"><h3 className="text-sm font-bold">竞品行动记录</h3><div className="mt-2 space-y-2">{gameState?.competitorState?.actions.length ? [...gameState.competitorState.actions].reverse().map((action) => <div key={action.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2 text-xs"><strong>第{action.round}阶段 · {npcs.find((npc) => npc.id === action.targetNpcId)?.name ?? '关键人'}</strong><span className={`rounded-full px-2 py-1 text-[10px] ${action.mitigated ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{action.mitigated ? '我方已部分对冲' : '产生压力'}</span></div><p className="mt-1 text-xs leading-5 text-slate-600">{action.summary}</p></div>) : <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">竞品尚未出现明显动作。</div>}</div></section>
          <h3 className="mt-5 border-t border-slate-100 pt-4 text-sm font-bold">竞品公开资料</h3>
          {competitors.length === 0 ? <div className="py-10 text-center text-sm text-slate-500">暂无竞品数据</div> : <div className="space-y-3">{competitors.map((competitor) => <div key={competitor.company_name} className="rounded-xl border border-slate-200 p-4"><div className="text-sm font-bold text-blue-700">{competitor.company_name}</div><div className="mt-2 text-xs text-slate-700">{competitor.features}</div><div className="mt-1 text-[11px] text-slate-500">{competitor.more_info || '暂无更多公开信息'}</div></div>)}</div>}
        </Modal>
      )}

      {invitationResult && (
        <Modal title="邀约结果" onClose={() => setInvitationResult(null)}>
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-700 text-lg font-bold text-white">{invitationResult.npcName.slice(0, 1)}</div><div><div className="font-bold">{invitationResult.npcName}</div><div className="text-xs text-slate-500">{invitationResult.npcTitle}</div></div></div>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">{invitationResult.feedback}</div>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-xl border border-slate-200 p-3"><span className="text-slate-500">状态</span><strong className="ml-2">{STATUS_LABELS[invitationResult.appointment.status] ?? invitationResult.appointment.status}</strong></div><div className="rounded-xl border border-slate-200 p-3"><span className="text-slate-500">执行</span><strong className="ml-2">接受后本阶段直接拜访</strong></div><div className="rounded-xl border border-slate-200 p-3"><span className="text-slate-500">地点</span><strong className="ml-2">{invitationResult.appointment.location}</strong></div><div className="rounded-xl border border-slate-200 p-3"><span className="text-slate-500">形式</span><strong className="ml-2">{VISIT_LABELS[invitationResult.appointment.visitType]}</strong></div></div>
        </Modal>
      )}

      {showEndDayCheck && (
        <Modal title={round < 5 ? '结束本阶段' : '进入项目提交检查'} onClose={() => setShowEndDayCheck(false)}>
          <p className="text-sm leading-6 text-slate-600">结束后将结算本阶段各公司的隐藏推进状态，并补充下一阶段行动点。</p>
          <div className="mt-4 space-y-2 text-xs"><CheckRow label="尚未执行的拜访" value={`${todayUnfinishedAppointments.length} 项`} warning={todayUnfinishedAppointments.length > 0} /><CheckRow label="未读会后待办" value={`${unreadFollowUps.length} 项`} warning={unreadFollowUps.length > 0} /><CheckRow label="剩余行动点" value={`${coins} 点`} warning={false} /></div>
          <div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowEndDayCheck(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">继续处理</button><button onClick={() => void finishStage()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">确认结束</button></div>
        </Modal>
      )}

      {showSubmissionCheck && (
        <Modal title="项目提交检查" onClose={() => setShowSubmissionCheck(false)}>
          <p className="text-sm leading-6 text-slate-600">提交后将立即结算本局，结果页会展示我方与竞品对比、客户内部决策回放与证据链。</p>
          <div className="mt-4 space-y-2 text-xs"><CheckRow label="决策链" value={gameState?.unlockedClues?.includes('decision_process') ? '已核实' : '未核实'} warning={!gameState?.unlockedClues?.includes('decision_process')} /><CheckRow label="公开信息" value="按需即时搜索" warning={false} /><CheckRow label="线下拜访纪要" value={`${meetingMinutes.length} 份`} warning={meetingMinutes.length === 0} /><CheckRow label="合规风险" value={gameState?.complianceRisks?.some((risk) => risk.status === 'latent' || risk.status === 'triggered') ? '存在风险' : '未发现高风险'} warning={Boolean(gameState?.complianceRisks?.some((risk) => risk.status === 'latent' || risk.status === 'triggered'))} /></div>
          {submissionWarnings.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><strong>提交前注意：</strong>{submissionWarnings.join('；')}</div>}
          <div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowSubmissionCheck(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">返回补充</button><button onClick={async () => { setShowSubmissionCheck(false); await runCommand('submit'); }} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white">确认提交并结算</button></div>
        </Modal>
      )}

      {competitorEvent && (
        <Modal title={`第${competitorEvent.round}阶段 · 竞品动态`} onClose={() => setCompetitorEvent(null)}>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">{competitorEvent.summary}</div><div className={`mt-3 rounded-xl border p-3 text-xs ${competitorEvent.mitigated ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{competitorEvent.mitigated ? '你此前积累的调研、拜访或材料已对冲部分压力。' : '该动作已影响目标联系人，请尽快核实并回应。'}</div>
        </Modal>
      )}

      {minutesDraft && (
        <Modal title="纠正拜访纪要" onClose={() => setMinutesDraft(null)}>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">修订会保留系统原始纪要和修订次数，便于结果回放和教练复盘。</div>
          <Field label="会谈摘要"><textarea value={minutesDraft.summary} onChange={(event) => setMinutesDraft((current) => current ? { ...current, summary: event.target.value } : current)} rows={3} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /></Field>
          <Field label="已确认事项（用分号分隔）"><textarea value={minutesDraft.confirmedItems} onChange={(event) => setMinutesDraft((current) => current ? { ...current, confirmedItems: event.target.value } : current)} rows={2} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /></Field>
          <Field label="客户承诺"><textarea value={minutesDraft.npcCommitments} onChange={(event) => setMinutesDraft((current) => current ? { ...current, npcCommitments: event.target.value } : current)} rows={2} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /></Field>
          <Field label="我方承诺"><textarea value={minutesDraft.playerCommitments} onChange={(event) => setMinutesDraft((current) => current ? { ...current, playerCommitments: event.target.value } : current)} rows={2} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /></Field>
          <Field label="下一步"><input value={minutesDraft.nextStep} onChange={(event) => setMinutesDraft((current) => current ? { ...current, nextStep: event.target.value } : current)} className="w-full rounded-xl border border-slate-200 p-3 text-sm" /></Field>
          <button onClick={() => void saveMeetingMinutes()} disabled={Boolean(commandBusy) || !minutesDraft.summary.trim() || !minutesDraft.nextStep.trim()} className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40">保存修订</button>
        </Modal>
      )}

      {publicInfoNpcId && publicInfoRecord && (
        <Modal title={`${npcs.find((npc) => npc.id === publicInfoNpcId)?.name ?? '人物'} · 公开资料卡`} onClose={() => setPublicInfoNpcId(null)}>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">本资料只包含公开可获得的信息。弱线索是准备方向，不代表人物的真实态度或最终决策权。</div>
          <section className="mt-4"><h3 className="text-sm font-bold text-slate-900">公开事实</h3><div className="mt-2 space-y-2">{publicInfoRecord.facts.map((fact) => <div key={fact} className="flex gap-2 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" /><span>{fact}</span></div>)}</div></section>
          <section className="mt-5"><h3 className="text-sm font-bold text-slate-900">可供准备参考的弱线索</h3><div className="mt-2 space-y-2">{publicInfoRecord.weakSignals.map((signal) => <div key={signal} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{signal}</div>)}</div></section>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[11px] text-slate-500"><span>来源：{publicInfoRecord.sourceNote}</span><span>本次搜索消耗 {publicInfoRecord.costPoints} 行动点；关闭后不保存显示</span></div>
        </Modal>
      )}

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>{children}</label>;
}

function CheckRow({ label, value, warning }: { label: string; value: string; warning: boolean }) {
  return <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${warning ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyPhoneState({ icon: Icon, title, description }: { icon: typeof Mail; title: string; description: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Icon className="h-6 w-6" /></div><div className="mt-3 text-sm font-bold text-slate-700">{title}</div><div className="mt-1 text-[11px] leading-5 text-slate-500">{description}</div></div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={onClose}><div className="max-h-[82vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="text-base font-bold">{title}</h2><button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="max-h-[calc(82vh-64px)] overflow-y-auto p-5">{children}</div></div></div>;
}
