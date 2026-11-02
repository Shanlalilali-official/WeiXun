'use client';

import { useEffect, useState } from 'react';
import {
  CUSTOMER_ACTIVITY_TYPES,
  type CustomerActivityType,
} from '@/lib/game/customer-activities';
import {
  withActivityExecutionProvider,
  type ActivityExecutionConfig,
} from '@/lib/game/customer-activity-execution-config';

type EditorTab = 'questions' | 'evaluation';
type ActivityQuestion = ActivityExecutionConfig['questionBanks'][CustomerActivityType][number];
type ActivityOption = ActivityQuestion['options'][number];

const ACTIVITY_LABELS: Record<CustomerActivityType, string> = {
  technical_meeting: '技术交流会',
  case_site_visit: '案例现场参观',
  company_visit: '客户参观我们公司',
  hospitality: '吃饭或喝酒邀约',
};

function makeNonAlcoholQuestion(): ActivityQuestion {
  return {
    id: 'hospitality_non_alcohol',
    title: '如果这次不饮酒，你会如何安排这场交流？',
    options: [
      { id: 'quiet_meal', text: '改为普通餐叙，继续围绕工作交流', supportDelta: 0, pleasureDelta: 0 },
      { id: 'coffee', text: '改约咖啡或茶，控制在较短时间', supportDelta: 0, pleasureDelta: 0 },
      { id: 'business_lunch', text: '改为工作日午餐，方便后续安排', supportDelta: 0, pleasureDelta: 0 },
      { id: 'decline', text: '尊重对方习惯，暂不安排这类邀约', supportDelta: 0, pleasureDelta: 0 },
    ] as ActivityQuestion['options'],
  };
}

function NumericField({
  value,
  label,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  value: number;
  label: string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled: boolean;
}) {
  const [rawValue, setRawValue] = useState(Number.isFinite(value) ? String(value) : '');

  useEffect(() => {
    setRawValue(Number.isFinite(value) ? String(value) : '');
  }, [value]);

  return <input
    type="number"
    min={min}
    max={max}
    step={step}
    inputMode={step < 1 ? 'decimal' : 'numeric'}
    value={rawValue}
    disabled={disabled}
    onChange={(event) => {
      const raw = event.target.value;
      setRawValue(raw);
      if (raw.trim() === '') {
        onChange(Number.NaN);
        return;
      }
      const parsed = Number(raw);
      onChange(Number.isFinite(parsed) ? parsed : Number.NaN);
    }}
    onBlur={() => {
      if (rawValue.trim() === '') setRawValue(Number.isFinite(value) ? String(value) : '');
    }}
    aria-label={label}
    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
  />;
}

function QuestionEditor({
  question,
  label,
  disabled,
  onChange,
}: {
  question: ActivityQuestion;
  label: string;
  disabled: boolean;
  onChange: (question: ActivityQuestion) => void;
}) {
  function updateOption(optionIndex: number, changes: Partial<ActivityOption>) {
    onChange({
      ...question,
      options: question.options.map((option, index) => index === optionIndex ? { ...option, ...changes } : option),
    });
  }

  return <section className="rounded-2xl border border-slate-200 p-4 sm:p-5" aria-label={label}>
    <label className="mb-4 block">
      <span className="mb-1 block text-xs font-semibold text-slate-700">题干</span>
      <input
        value={question.title}
        maxLength={600}
        disabled={disabled}
        onChange={(event) => onChange({ ...question, title: event.target.value })}
        aria-label={label + '题干'}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
      />
    </label>
    <div className="space-y-3">
      {question.options.map((option, optionIndex) => <div key={option.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-[minmax(0,1fr)_115px_115px] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-700">选项 {optionIndex + 1}</span>
          <input
            value={option.text}
            maxLength={320}
            disabled={disabled}
            onChange={(event) => updateOption(optionIndex, { text: event.target.value })}
            aria-label={label + '选项 ' + (optionIndex + 1) + '文字'}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">支持度变化</span>
          <NumericField value={option.supportDelta} min={-5} max={4} label={label + '选项 ' + (optionIndex + 1) + '支持度变化'} disabled={disabled} onChange={(supportDelta) => updateOption(optionIndex, { supportDelta })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-600">愉悦度变化</span>
          <NumericField value={option.pleasureDelta} min={-8} max={6} label={label + '选项 ' + (optionIndex + 1) + '愉悦度变化'} disabled={disabled} onChange={(pleasureDelta) => updateOption(optionIndex, { pleasureDelta })} />
        </label>
      </div>)}
    </div>
    <p className="mt-3 text-[11px] leading-5 text-slate-500">每个选项提交后会记录对应变化量；支持度范围 -5 到 4，愉悦度范围 -8 到 6。</p>
  </section>;
}

export function CustomerActivityExecutionEditor({
  tab,
  value,
  disabled,
  onChange,
}: {
  tab: EditorTab;
  value: ActivityExecutionConfig;
  disabled: boolean;
  onChange: (value: ActivityExecutionConfig) => void;
}) {
  const [selectedActivity, setSelectedActivity] = useState<CustomerActivityType>('technical_meeting');

  function updateBankQuestion(index: number, question: ActivityQuestion) {
    onChange({
      ...value,
      questionBanks: {
        ...value.questionBanks,
        [selectedActivity]: value.questionBanks[selectedActivity].map((current, currentIndex) => currentIndex === index ? question : current),
      },
    });
  }

  if (tab === 'questions') {
    const questions = value.questionBanks[selectedActivity];
    return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="activity-quiz-settings">
      <div>
        <h2 id="activity-quiz-settings" className="text-sm font-semibold text-slate-900">活动情境题</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">每项活动固定三道题，每题四个选项。编辑题干、选项和提交后的状态变化。</p>
      </div>
      <div role="tablist" aria-label="选择要编辑的活动题库" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {CUSTOMER_ACTIVITY_TYPES.map((activity) => <button
          key={activity}
          type="button"
          role="tab"
          aria-selected={selectedActivity === activity}
          onClick={() => setSelectedActivity(activity)}
          className={'rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors ' + (selectedActivity === activity ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500' : 'border-slate-200 text-slate-700 hover:border-slate-300')}
        >{ACTIVITY_LABELS[activity]}</button>)}
      </div>
      <label className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
        <span><strong className="block text-sm text-slate-900">问答时限</strong><span className="mt-1 block text-xs leading-5 text-slate-600">玩家提交活动方案后完成情境题的时间。</span></span>
        <span className="flex items-center gap-2"><NumericField value={value.quizDurationSeconds} min={30} max={600} label="问答时限（秒）" disabled={disabled} onChange={(quizDurationSeconds) => onChange({ ...value, quizDurationSeconds })} /><span className="text-xs text-slate-500">秒</span></span>
      </label>
      <div className="space-y-4" role="tabpanel" aria-label={ACTIVITY_LABELS[selectedActivity]}>
        {questions.map((question, index) => <QuestionEditor
          key={question.id}
          question={question}
          label={ACTIVITY_LABELS[selectedActivity] + '第 ' + (index + 1) + ' 题'}
          disabled={disabled}
          onChange={(nextQuestion) => updateBankQuestion(index, nextQuestion)}
        />)}
      </div>
      {selectedActivity === 'hospitality' && <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5" aria-labelledby="hospitality-nonalcohol-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="hospitality-nonalcohol-heading" className="text-sm font-semibold text-slate-900">无酒精替代情境题</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">启用后，玩家方案已注明不饮酒、无酒精或不谈工作等安排时，使用此题替换第二道现场情境题。</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={value.hospitalityNonAlcoholQuestion !== null}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, hospitalityNonAlcoholQuestion: event.target.checked ? makeNonAlcoholQuestion() : null })}
              aria-label="启用无酒精替代情境题"
            />
            启用替代题
          </label>
        </div>
        {value.hospitalityNonAlcoholQuestion && <div className="mt-4">
          <QuestionEditor
            question={value.hospitalityNonAlcoholQuestion}
            label="无酒精替代题"
            disabled={disabled}
            onChange={(hospitalityNonAlcoholQuestion) => onChange({ ...value, hospitalityNonAlcoholQuestion })}
          />
        </div>}
      </section>}
    </section>;
  }

  function updateLimit(key: keyof ActivityExecutionConfig['limits'], nextValue: number) {
    onChange({ ...value, limits: { ...value.limits, [key]: nextValue } });
  }

  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="activity-ai-evaluation-settings">
    <div>
      <h2 id="activity-ai-evaluation-settings" className="text-sm font-semibold text-slate-900">方案 AI 评价与数值结算</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">AI 独立评价玩家的文字方案；情境题按选项规则计算影响，两部分按权重合并后只应用一次。</p>
    </div>
    <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <legend className="px-1 text-xs font-semibold text-slate-700">方案评价引擎</legend>
      <p className="text-xs leading-5 text-slate-600">此选择独立于全局匹配决策模式，只决定方案文字评价引擎；两种引擎共用下方的评价指引、数值边界和方案/问答权重。选择只影响新创建的活动；已创建的活动继续使用创建时冻结的引擎。LLM 使用当前项目配置的模型，Jev 复用服务端 JEV 配置，不需要也不会向浏览器提供服务端密钥。</p>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="方案评价引擎">
        {([
          ['llm', 'LLM', '使用当前项目配置的模型。'],
          ['jev', 'Jev', '复用服务端 JEV 配置；共用下方评价指引、数值边界和权重。'],
        ] as const).map(([provider, label, description]) => <label
          key={provider}
          className={'flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition-colors ' + (value.evaluationProvider === provider ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200') + (disabled ? ' cursor-not-allowed opacity-70' : '')}
        >
          <input
            type="radio"
            name="activity-evaluation-provider"
            value={provider}
            checked={value.evaluationProvider === provider}
            disabled={disabled}
            onChange={() => onChange(withActivityExecutionProvider(value, provider))}
            aria-label={label}
            className="mt-0.5 accent-emerald-600"
          />
          <span>
            <strong className="block text-sm text-slate-900">{label}</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span>
          </span>
        </label>)}
      </div>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-950">如果 Jev 服务端未配置可用密钥，活动会保留为待评价状态，可配置后重试；系统不会自动改用 LLM。</p>
    </fieldset>
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-700">方案评价指引</span>
      <textarea
        value={value.aiInstructions}
        maxLength={8000}
        rows={8}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, aiInstructions: event.target.value })}
        aria-label="方案 AI 评价指引"
        className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
      />
      <span className="mt-1 block text-[11px] leading-5 text-slate-500">用业务语言说明如何评价方案质量，最多 8000 字。此内容作为评价参考，不能替代系统的固定规则。</span>
    </label>
    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-950">玩家未提交方案时，系统仍施加固定的准备不足负向影响；自定义权重和上下限不会取消这项处理。</p>

    <fieldset disabled={disabled} className="space-y-3">
      <legend className="text-xs font-semibold text-slate-700">AI 评价与最终增量上下限</legend>
      <p className="text-[11px] leading-5 text-slate-500">最小值不可高于 0，最大值不可低于 0；这些范围同时约束 AI 方案评价和按权重合并后的最终增量。</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {([
          ['supportMin', '支持度最小变化', -5, 0],
          ['supportMax', '支持度最大变化', 0, 4],
          ['pleasureMin', '愉悦度最小变化', -8, 0],
          ['pleasureMax', '愉悦度最大变化', 0, 6],
          ['dimensionMin', '能力维度最小变化', -3, 0],
          ['dimensionMax', '能力维度最大变化', 0, 3],
        ] as const).map(([key, label, min, max]) => <label key={key} className="grid gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <span className="text-[11px] font-medium text-slate-600">{label}</span>
          <NumericField value={value.limits[key]} min={min} max={max} label={label} disabled={disabled} onChange={(nextValue) => updateLimit(key, nextValue)} />
        </label>)}
      </div>
    </fieldset>

    <fieldset disabled={disabled} className="space-y-3">
      <legend className="text-xs font-semibold text-slate-700">方案与问答影响权重</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {([
          ['plan', '方案评分权重'],
          ['quiz', '情境题评分权重'],
        ] as const).map(([key, label]) => <label key={key} className="grid gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <span className="text-[11px] font-medium text-slate-600">{label}</span>
          <NumericField value={value.weights[key]} min={0} max={1} step={0.01} label={label} disabled={disabled} onChange={(nextValue) => onChange({ ...value, weights: { ...value.weights, [key]: nextValue } })} />
        </label>)}
      </div>
      <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-950">方案评分与答题变化分别按权重计入同一份最终增量，再统一裁剪到上方边界并应用一次；不会将合并后的结果重复应用。权重范围为 0–1，最多两位小数，且不能同时为 0。</p>
    </fieldset>
  </section>;
}
