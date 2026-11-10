'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BrainCircuit, FileText, LoaderCircle, RotateCcw, Save, Search, ShieldCheck } from 'lucide-react';

type RuntimePrompt = {
  id: string;
  label: string;
  group: string;
  description: string;
  defaultText: string;
  boundary: string;
};

type RuntimePromptResponse = {
  success: true;
  revision: number;
  catalog: RuntimePrompt[];
  overrides: Record<string, string>;
};

const PROMPT_URL = '/api/designer/runtime-prompts';
const MAX_PROMPT_CHARS = 12_000;

function sessionHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-session': window.localStorage.getItem('weixun_session') || '',
  };
}

function normalizeResponse(value: unknown): RuntimePromptResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Partial<RuntimePromptResponse>;
  if (raw.success !== true || !Number.isInteger(raw.revision) || !Array.isArray(raw.catalog)
    || !raw.overrides || typeof raw.overrides !== 'object' || Array.isArray(raw.overrides)) return null;
  const catalog = raw.catalog.filter((item): item is RuntimePrompt => (
    Boolean(item)
    && typeof item.id === 'string' && item.id.length > 0
    && typeof item.label === 'string'
    && typeof item.group === 'string'
    && typeof item.description === 'string'
    && typeof item.defaultText === 'string'
    && typeof item.boundary === 'string'
  ));
  const overrides = Object.fromEntries(Object.entries(raw.overrides).filter((entry): entry is [string, string] => (
    typeof entry[0] === 'string' && typeof entry[1] === 'string'
  )));
  return { success: true, revision: raw.revision as number, catalog, overrides };
}

function effectiveText(item: RuntimePrompt, overrides: Record<string, string>): string {
  return overrides[item.id] ?? item.defaultText;
}

function groupCatalog(items: RuntimePrompt[]): Array<{ group: string; items: RuntimePrompt[] }> {
  const groups = new Map<string, RuntimePrompt[]>();
  for (const item of items) {
    const itemsInGroup = groups.get(item.group) ?? [];
    itemsInGroup.push(item);
    groups.set(item.group, itemsInGroup);
  }
  return Array.from(groups, ([group, groupedItems]) => ({ group, items: groupedItems }));
}

export default function RuntimePromptsPage() {
  const [catalog, setCatalog] = useState<RuntimePrompt[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [resetIntents, setResetIntents] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const latestDraftState = useRef({ catalog, drafts, overrides, resetIntents });
  latestDraftState.current = { catalog, drafts, overrides, resetIntents };

  const dirtyIds = useMemo(() => catalog
    .filter((item) => (drafts[item.id] ?? effectiveText(item, overrides)) !== effectiveText(item, overrides))
    .map((item) => item.id), [catalog, drafts, overrides]);
  const invalidDraftIds = useMemo(() => catalog.filter((item) => {
    const value = drafts[item.id] ?? effectiveText(item, overrides);
    return (value !== item.defaultText && !value.trim()) || value.length > MAX_PROMPT_CHARS;
  }).map((item) => item.id), [catalog, drafts, overrides]);
  const groups = useMemo(() => Array.from(new Set(catalog.map(({ group }) => group))), [catalog]);
  const visibleGroups = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase();
    const filtered = catalog.filter((item) => {
      if (selectedGroup !== 'all' && item.group !== selectedGroup) return false;
      if (!query) return true;
      const text = [item.id, item.label, item.group, item.description, item.boundary, item.defaultText, drafts[item.id] ?? '']
        .join('\n')
        .toLocaleLowerCase();
      return text.includes(query);
    });
    return groupCatalog(filtered);
  }, [catalog, drafts, searchText, selectedGroup]);

  const readConfig = useCallback(async (options: { preserveDrafts?: boolean; showNotice?: boolean } = {}) => {
    const {
      catalog: currentCatalog,
      drafts: currentDrafts,
      overrides: currentOverrides,
      resetIntents: currentResetIntents,
    } = latestDraftState.current;
    const dirtyDrafts: Record<string, string> = options.preserveDrafts
      ? Object.fromEntries(currentCatalog.flatMap((item) => {
        const value = currentDrafts[item.id] ?? effectiveText(item, currentOverrides);
        return value === effectiveText(item, currentOverrides) ? [] : [[item.id, value]];
      }))
      : {};
    if (options.preserveDrafts) Object.assign(dirtyDrafts, currentResetIntents);
    setLoading(true);
    if (!options.preserveDrafts) setNotice('');
    try {
      const response = await fetch(PROMPT_URL, { method: 'GET', headers: sessionHeaders(), cache: 'no-store' });
      const body: unknown = await response.json().catch(() => null);
      const data = normalizeResponse(body);
      if (!response.ok || !data) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : '运行时提示词目录读取失败。';
        throw new Error(message);
      }
      setCatalog(data.catalog);
      setOverrides(data.overrides);
      setRevision(data.revision);
      setLoaded(true);
      setDrafts(Object.fromEntries(data.catalog.map((item) => [
        item.id,
        Object.prototype.hasOwnProperty.call(dirtyDrafts, item.id)
          ? dirtyDrafts[item.id]
          : effectiveText(item, data.overrides),
      ])));
      setResetIntents({});
      setConflict(false);
      setNoticeIsError(false);
      if (options.showNotice) setNotice('已读取最新版本，本地修改已保留。检查后可以再次保存。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '运行时提示词目录读取失败。');
      setNoticeIsError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void readConfig();
  }, [readConfig]);

  function buildOverrides(): Record<string, string> {
    return Object.fromEntries(catalog.flatMap((item) => {
      const value = drafts[item.id] ?? effectiveText(item, overrides);
      return value === item.defaultText ? [] : [[item.id, value]];
    }));
  }

  function keepDrafts(data: RuntimePromptResponse) {
    setCatalog(data.catalog);
    setOverrides(data.overrides);
    setRevision(data.revision);
    setDrafts((current) => Object.fromEntries(data.catalog.map((item) => [
      item.id,
      current[item.id] ?? effectiveText(item, data.overrides),
    ])));
    setConflict(false);
  }

  async function saveAll() {
    if (saving || dirtyIds.length === 0) return;
    if (invalidDraftIds.length > 0) {
      setNotice('自定义提示词不能为空且最多 12,000 字。系统默认本身为空的条目可以保持为空。');
      setNoticeIsError(true);
      return;
    }
    setSaving(true);
    setNotice('');
    setNoticeIsError(false);
    try {
      const response = await fetch(PROMPT_URL, {
        method: 'PUT',
        headers: sessionHeaders(),
        body: JSON.stringify({ expectedRevision: revision, overrides: buildOverrides() }),
      });
      const body: unknown = await response.json().catch(() => null);
      const data = normalizeResponse(body);
      if (response.status === 409) {
        setConflict(true);
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : '配置已在其他窗口更新。你的编辑仍保留在页面中。';
        setNotice(`${message} 读取最新版本后，可以保留并重新提交这些修改。`);
        setNoticeIsError(true);
        return;
      }
      if (!response.ok || !data) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : '运行时提示词保存失败。';
        throw new Error(message);
      }
      keepDrafts(data);
      setDrafts(Object.fromEntries(data.catalog.map((item) => [item.id, effectiveText(item, data.overrides)])));
      setResetIntents({});
      setNotice('运行时提示词已保存，新请求将使用保存后的内容。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '运行时提示词保存失败。');
      setNoticeIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function resetOne(item: RuntimePrompt) {
    if (saving || resettingId) return;
    setResettingId(item.id);
    setNotice('');
    setNoticeIsError(false);
    const nextOverrides = { ...overrides };
    delete nextOverrides[item.id];
    try {
      const response = await fetch(PROMPT_URL, {
        method: 'PUT',
        headers: sessionHeaders(),
        body: JSON.stringify({ expectedRevision: revision, overrides: nextOverrides }),
      });
      const body: unknown = await response.json().catch(() => null);
      const data = normalizeResponse(body);
      if (response.status === 409) {
        setDrafts((current) => ({ ...current, [item.id]: item.defaultText }));
        setResetIntents((current) => ({ ...current, [item.id]: item.defaultText }));
        setConflict(true);
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : '配置已在其他窗口更新。你的编辑仍保留在页面中。';
        setNotice(`${message} 读取最新版本后，可以保留并重新提交这些修改。`);
        setNoticeIsError(true);
        return;
      }
      if (!response.ok || !data) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : '恢复默认内容失败。';
        throw new Error(message);
      }
      setCatalog(data.catalog);
      setOverrides(data.overrides);
      setRevision(data.revision);
      setDrafts((current) => Object.fromEntries(data.catalog.map((entry) => [
        entry.id,
        entry.id === item.id ? effectiveText(entry, data.overrides) : current[entry.id] ?? effectiveText(entry, data.overrides),
      ])));
      setResetIntents((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      setConflict(false);
      setNotice(`“${item.label}”已恢复默认，服务端自定义覆盖已删除。`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '恢复默认内容失败。');
      setNoticeIsError(true);
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
          <Link
            href="/designer"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="返回设计师工作台"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700"><FileText className="h-5 w-5" /></span>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">运行时业务规则与提示词</h1>
              <p className="mt-0.5 text-xs text-slate-500">编辑真实业务调用使用的提示词；固定安全边界始终单独展示。</p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <span className={`mr-1 text-xs font-medium ${dirtyIds.length ? 'text-amber-700' : loaded ? 'text-emerald-700' : 'text-slate-500'}`} role="status">
              {loading ? '正在读取…' : !loaded ? '尚未读取' : dirtyIds.length ? `${dirtyIds.length} 项尚未保存` : `已保存 · 版本 ${revision}`}
            </span>
            {conflict && (
              <button
                type="button"
                onClick={() => void readConfig({ preserveDrafts: true, showNotice: true })}
                disabled={loading || saving || Boolean(resettingId)}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                读取最新版本并保留我的修改
              </button>
            )}
            <button
              type="button"
              onClick={() => void saveAll()}
              disabled={loading || saving || Boolean(resettingId) || dirtyIds.length === 0 || invalidDraftIds.length > 0}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? '保存中…' : '保存修改'}
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1560px] flex-wrap gap-2 px-5 pb-3 sm:px-6" aria-label="提示词与规则配置">
          <Link href="/designer/jev-config" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100">结构化决策提示词</Link>
          <Link href="/designer/prompt-library" className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100">人物与渠道提示词</Link>
          <Link href="/designer/customer-activities" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">客户活动规则设置</Link>
        </nav>
      </header>

      <main className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-950">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          <p>每条编辑框展示当前生效文本：已保存的自定义覆盖优先，否则使用系统默认文本。描述说明实际运行位置；下方固定边界只读，不会被此编辑器修改。</p>
        </div>

        {notice && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm leading-6 ${noticeIsError ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`} role={noticeIsError ? 'alert' : 'status'}>
            {notice}
          </div>
        )}

        <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="搜索与筛选提示词">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
            <label className="relative block">
              <span className="sr-only">搜索规则名称、用途或文本</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="搜索名称、调用位置、固定边界或提示词内容"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="shrink-0">分组</span>
              <select
                value={selectedGroup}
                onChange={(event) => setSelectedGroup(event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="all">全部分组</option>
                {groups.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500" aria-live="polite">显示 {visibleGroups.reduce((count, group) => count + group.items.length, 0)} / {catalog.length} 条运行时提示词。</p>
        </section>

        {loading && catalog.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
            <LoaderCircle className="mx-auto mb-3 h-5 w-5 animate-spin text-blue-600" />正在读取运行时提示词目录…
          </div>
        ) : !loaded ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">运行时提示词目录尚未读取成功。</p>
            <button type="button" onClick={() => void readConfig()} disabled={loading} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">重新读取</button>
          </div>
        ) : !loading && catalog.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">暂时没有可编辑的运行时提示词。</p>
            <button type="button" onClick={() => void readConfig()} className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">重新读取</button>
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">没有符合当前搜索条件的规则。</div>
        ) : (
          <div className="space-y-7">
            {visibleGroups.map(({ group, items }) => (
              <section key={group} aria-labelledby={`runtime-prompts-${group}`}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700"><BrainCircuit className="h-4 w-4" /></span>
                  <div>
                    <h2 id={`runtime-prompts-${group}`} className="text-sm font-semibold text-slate-900">{group}</h2>
                    <p className="mt-0.5 text-[11px] text-slate-500">{items.length} 条规则</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {items.map((item) => {
                    const savedText = effectiveText(item, overrides);
                    const value = drafts[item.id] ?? savedText;
                    const isDirty = value !== savedText;
                    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, item.id);
                    return (
                      <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-900">{item.label}</h3>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">{item.id}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isDirty ? 'bg-amber-100 text-amber-800' : hasOverride ? 'bg-violet-100 text-violet-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {isDirty ? '未保存' : hasOverride ? '自定义覆盖' : '系统默认'}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-600"><strong className="font-semibold text-slate-700">实际调用位置：</strong>{item.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void resetOne(item)}
                            disabled={loading || saving || Boolean(resettingId) || (!hasOverride && value === item.defaultText)}
                            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {resettingId === item.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            恢复默认并删除覆盖
                          </button>
                        </div>
                        <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
                          <div>
                            <label htmlFor={`runtime-prompt-${item.id}`} className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-700">
                              <span>当前生效的可编辑文本</span>
                              <span className="font-normal text-slate-400">{value.length.toLocaleString()} / {MAX_PROMPT_CHARS.toLocaleString()} 字 · 默认为空时可保持空白</span>
                            </label>
                            <textarea
                              id={`runtime-prompt-${item.id}`}
                              value={value}
                              onChange={(event) => {
                                setDrafts((current) => ({ ...current, [item.id]: event.target.value }));
                                setResetIntents((current) => {
                                  if (!Object.hasOwn(current, item.id)) return current;
                                  const next = { ...current };
                                  delete next[item.id];
                                  return next;
                                });
                              }}
                              disabled={loading || saving || Boolean(resettingId)}
                              maxLength={MAX_PROMPT_CHARS}
                              spellCheck
                              rows={Math.max(8, Math.min(18, value.split('\n').length + 3))}
                              className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-3 font-mono text-xs leading-6 text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                            />
                            {invalidDraftIds.includes(item.id) && <p className="mt-1 text-xs text-rose-700" role="alert">自定义提示词不能为空且最多 12,000 字。</p>}
                            <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                              <summary className="cursor-pointer text-xs font-semibold text-slate-600">查看系统默认文本</summary>
                              <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-slate-600">{item.defaultText}</pre>
                            </details>
                          </div>
                          <aside className="space-y-3" aria-label={`${item.label}的固定边界`}>
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-950"><ShieldCheck className="h-4 w-4 text-amber-700" />固定安全与输出边界 · 只读</div>
                              <p className="whitespace-pre-wrap text-xs leading-5 text-amber-950">{item.boundary || '本规则没有额外的固定边界说明。'}</p>
                            </div>
                            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs leading-5 text-blue-950">
                              编辑文本会进入上方标注的运行位置。代码仍负责候选项、分数、权限、证据和状态校验；保存后仅影响后续请求。
                            </div>
                          </aside>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
