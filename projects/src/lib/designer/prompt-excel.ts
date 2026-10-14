import ExcelJS from 'exceljs';
import {
  PROJECT_ONE_CHANNEL_MODIFIERS,
  PROJECT_ONE_FIVE_PERSON_NPCS,
  PROJECT_ONE_FIVE_PERSON_IDS,
  type ProjectOneChannelId,
  type ProjectOneFivePersonId,
} from '@/lib/designer/project-one-five-person';
import {
  createNpcRolePromptProfile,
  normalizeNpcRolePrompt,
  type NpcRolePromptProfile,
  type ProjectOnePromptConfig,
} from '@/lib/designer/prompt-config';

export const PROMPT_EXCEL_INSTRUCTION_SHEET = '填写说明';
export const PROMPT_EXCEL_DATA_SHEET = '人物提示词';
export const PROMPT_EXCEL_HEADERS = ['人物姓名', '提示词用途', '交流方式', '提示词内容'] as const;
// 旧版表头只用于导入兼容，新导出的工作簿不再使用。
export const PROMPT_EXCEL_LEGACY_HEADERS = ['人物 ID', '范围', '渠道 ID', '提示词'] as const;
export const PROMPT_EXCEL_SCOPES = ['role_base', 'role_low', 'role_medium', 'role_high', 'channel'] as const;
export const PROMPT_EXCEL_MAX_TEXT_LENGTH = 12_000;
export const PROMPT_EXCEL_MAX_ROWS = 500;

export type PromptExcelScope = (typeof PROMPT_EXCEL_SCOPES)[number];

export const PROMPT_EXCEL_SCOPE_LABELS: Readonly<Record<PromptExcelScope, string>> = {
  role_base: '人物基础提示词',
  role_low: '低支持度提示词',
  role_medium: '中支持度提示词',
  role_high: '高支持度提示词',
  channel: '渠道补充',
};
export const PROMPT_EXCEL_PROMPT_TYPE_LABELS = [
  PROMPT_EXCEL_SCOPE_LABELS.role_base,
  PROMPT_EXCEL_SCOPE_LABELS.role_low,
  PROMPT_EXCEL_SCOPE_LABELS.role_medium,
  PROMPT_EXCEL_SCOPE_LABELS.role_high,
  PROMPT_EXCEL_SCOPE_LABELS.channel,
] as const;

export const PROMPT_EXCEL_NPC_IDS: readonly ProjectOneFivePersonId[] = PROJECT_ONE_FIVE_PERSON_IDS;
export const PROMPT_EXCEL_NPC_NAMES: readonly string[] = PROMPT_EXCEL_NPC_IDS.map(
  (npcId) => PROJECT_ONE_FIVE_PERSON_NPCS[npcId].name,
);
export const PROMPT_EXCEL_CHANNEL_IDS: readonly ProjectOneChannelId[] = Object.keys(
  PROJECT_ONE_CHANNEL_MODIFIERS,
) as ProjectOneChannelId[];
export const PROMPT_EXCEL_CHANNEL_LABELS: readonly string[] = PROMPT_EXCEL_CHANNEL_IDS.map(
  (channelId) => PROJECT_ONE_CHANNEL_MODIFIERS[channelId].label,
);

export interface PromptExcelRow {
  npcId: string;
  scope: string;
  channelId: string;
  prompt: string;
}

export interface PromptExcelValidationIssue {
  row?: number;
  field?: string;
  code?: string;
  message: string;
}

export type PromptExcelEditableConfig = Pick<
  ProjectOnePromptConfig,
  'npcRolePrompts' | 'npcChannelExceptions'
>;

export interface PromptExcelImportResult {
  ok: boolean;
  sheetName: string;
  rows: PromptExcelRow[];
  errors: PromptExcelValidationIssue[];
  editable: PromptExcelEditableConfig | null;
  summary: {
    totalRows: number;
    validRows: number;
    errorCount: number;
  };
}

export class PromptExcelRequestError extends Error {
  readonly status: 400 | 413;
  readonly code: 'INVALID_XLSX' | 'ROW_LIMIT_EXCEEDED';

  constructor(message: string, status: 400 | 413, code: 'INVALID_XLSX' | 'ROW_LIMIT_EXCEEDED') {
    super(message);
    this.name = 'PromptExcelRequestError';
    this.status = status;
    this.code = code;
  }
}

const NPC_ID_SET = new Set<string>(PROMPT_EXCEL_NPC_IDS);
const CHANNEL_ID_SET = new Set<string>(PROMPT_EXCEL_CHANNEL_IDS);
const SCOPE_SET = new Set<string>(PROMPT_EXCEL_SCOPES);
const NPC_NAME_TO_ID = new Map<string, ProjectOneFivePersonId>();
const CHANNEL_LABEL_TO_ID = new Map<string, ProjectOneChannelId>();

for (const npcId of PROMPT_EXCEL_NPC_IDS) {
  const name = PROJECT_ONE_FIVE_PERSON_NPCS[npcId].name.trim();
  if (!name || NPC_NAME_TO_ID.has(name)) {
    throw new Error('人物姓名必须唯一，才能用于人物提示词表格。');
  }
  NPC_NAME_TO_ID.set(name, npcId);
}

for (const channelId of PROMPT_EXCEL_CHANNEL_IDS) {
  const label = PROJECT_ONE_CHANNEL_MODIFIERS[channelId].label.trim();
  if (!label || CHANNEL_LABEL_TO_ID.has(label)) {
    throw new Error('交流方式名称必须唯一，才能用于人物提示词表格。');
  }
  CHANNEL_LABEL_TO_ID.set(label, channelId);
}

type PromptExcelColumn = 'npcId' | 'scope' | 'channelId' | 'prompt';
type PromptExcelHeaderFamily = 'current' | 'legacy';

const HEADER_ALIASES = new Map<string, PromptExcelColumn>([
  [PROMPT_EXCEL_HEADERS[0], 'npcId'],
  [PROMPT_EXCEL_HEADERS[1], 'scope'],
  [PROMPT_EXCEL_HEADERS[2], 'channelId'],
  [PROMPT_EXCEL_HEADERS[3], 'prompt'],
  [PROMPT_EXCEL_LEGACY_HEADERS[0], 'npcId'],
  [PROMPT_EXCEL_LEGACY_HEADERS[1], 'scope'],
  [PROMPT_EXCEL_LEGACY_HEADERS[2], 'channelId'],
  [PROMPT_EXCEL_LEGACY_HEADERS[3], 'prompt'],
]);
const CURRENT_HEADER_SET = new Set<string>(PROMPT_EXCEL_HEADERS);
const LEGACY_HEADER_SET = new Set<string>(PROMPT_EXCEL_LEGACY_HEADERS);
const PROMPT_EXCEL_COLUMNS: readonly PromptExcelColumn[] = ['npcId', 'scope', 'channelId', 'prompt'];

function npcNameFor(npcId: string): string {
  return NPC_ID_SET.has(npcId) ? PROJECT_ONE_FIVE_PERSON_NPCS[npcId as ProjectOneFivePersonId].name : npcId;
}

function channelLabelFor(channelId: string): string {
  return CHANNEL_ID_SET.has(channelId)
    ? PROJECT_ONE_CHANNEL_MODIFIERS[channelId as ProjectOneChannelId].label
    : channelId;
}

function normalizeNpcId(value: string): string {
  return NPC_ID_SET.has(value) ? value : NPC_NAME_TO_ID.get(value) ?? value;
}

function normalizeScope(value: string): string {
  // Previous workbooks used one role row. Treat it as the preserved base
  // manuscript and supply default tier text during import.
  if (value === 'role' || value === '人物总提示词') return 'role_base';
  if (value === PROMPT_EXCEL_SCOPE_LABELS.role_base) return 'role_base';
  if (value === PROMPT_EXCEL_SCOPE_LABELS.role_low) return 'role_low';
  if (value === PROMPT_EXCEL_SCOPE_LABELS.role_medium) return 'role_medium';
  if (value === PROMPT_EXCEL_SCOPE_LABELS.role_high) return 'role_high';
  if (value === PROMPT_EXCEL_SCOPE_LABELS.channel) return 'channel';
  return value;
}

function normalizeChannelId(value: string): string {
  return CHANNEL_ID_SET.has(value) ? value : CHANNEL_LABEL_TO_ID.get(value) ?? value;
}

function hasOwn(value: object | null | undefined, key: PropertyKey): boolean {
  return Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const candidate = value as {
      formula?: unknown;
      result?: unknown;
      text?: unknown;
      richText?: unknown;
    };
    if (typeof candidate.formula === 'string') return candidate.formula;
    if (typeof candidate.text === 'string') return candidate.text;
    if (Array.isArray(candidate.richText)) {
      return candidate.richText
        .map((item) => (item && typeof item === 'object' && 'text' in item
          ? String((item as { text?: unknown }).text ?? '')
          : ''))
        .join('');
    }
    if (candidate.result !== undefined && candidate.result !== null) return String(candidate.result);
  }
  return String(value);
}

function isBlank(value: unknown): boolean {
  return cellText(value).trim() === '';
}

function rowIsBlank(row: ExcelJS.Row): boolean {
  for (let column = 1; column <= row.cellCount; column += 1) {
    if (!isBlank(row.getCell(column).value)) return false;
  }
  return true;
}

function applyHeaderStyle(cell: ExcelJS.Cell): void {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    bottom: { style: 'thin', color: { argb: 'BFDBFE' } },
  };
}

function applyDataStyle(cell: ExcelJS.Cell): void {
  cell.alignment = { vertical: 'top', wrapText: true };
  cell.border = {
    bottom: { style: 'hair', color: { argb: 'E5E7EB' } },
  };
}

function rolePromptFor(config: ProjectOnePromptConfig, npcId: ProjectOneFivePersonId): string {
  return normalizeNpcRolePrompt(config.npcRolePrompts[npcId]).base;
}

function promptRowsForConfig(config: ProjectOnePromptConfig): PromptExcelRow[] {
  const rows: PromptExcelRow[] = PROMPT_EXCEL_NPC_IDS.flatMap((npcId) => {
    const profile = normalizeNpcRolePrompt(config.npcRolePrompts[npcId]);
    return (['base', 'low', 'medium', 'high'] as const).map((field) => ({
      npcId,
      scope: `role_${field}`,
      channelId: '',
      prompt: field === 'base' ? rolePromptFor(config, npcId) : profile[field],
    }));
  });

  for (const npcId of PROMPT_EXCEL_NPC_IDS) {
    const exceptions = config.npcChannelExceptions[npcId];
    if (!exceptions) continue;
    // 按登记顺序导出，忽略过期或未知的人物和交流方式配置。
    for (const channelId of PROMPT_EXCEL_CHANNEL_IDS) {
      if (!hasOwn(exceptions, channelId)) continue;
      rows.push({
        npcId,
        scope: 'channel',
        channelId,
        prompt: exceptions[channelId] ?? '',
      });
    }
  }
  return rows;
}

export function createPromptExcelWorkbook(config: ProjectOnePromptConfig): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();

  const instructions = workbook.addWorksheet(PROMPT_EXCEL_INSTRUCTION_SHEET);
  instructions.getColumn(1).width = 20;
  instructions.getColumn(2).width = 90;
  instructions.properties.defaultRowHeight = 20;
  instructions.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
  instructions.mergeCells('A1:B1');
  instructions.getCell('A1').value = '项目一人物提示词';
  instructions.getCell('A1').font = { bold: true, size: 15, color: { argb: '1D4ED8' } };
  instructions.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  instructions.getRow(1).height = 26;
  instructions.mergeCells('A2:B2');
  instructions.getCell('A2').value = '请在“人物提示词”工作表中填写四列，保留表头后保存并上传；每位人物包含基础、低/中/高支持度四行。';
  instructions.getCell('A2').alignment = { wrapText: true, vertical: 'top' };
  instructions.getRow(2).height = 28;
  const instructionHeader = instructions.addRow(['填写项', '说明']);
  instructionHeader.eachCell((cell) => applyHeaderStyle(cell));
  [
    ['提示词用途', '每位人物填写“人物基础提示词”和低、中、高三档支持度提示词；“渠道补充”只在指定交流方式下补充。'],
    ['交流方式', '人物基础和三档支持度提示词行留空；渠道补充行请从下拉选项中选择交流方式。'],
    ['已读不回偏好', '可在“人物总提示词”或邮件、工作微信补充中写此人何种情形倾向已读不回，最终判断仍受系统规则控制。'],
    ['填写检查', `每个人物保留基础、低、中、高四行；单个提示词最多 ${PROMPT_EXCEL_MAX_TEXT_LENGTH} 个字符。旧版单行“人物总提示词”会作为基础提示词导入。`],
    ['导入保存', '上传后先查看校验结果，确认无误后在提示词页面点击“保存全部”。'],
  ].forEach(([name, description]) => {
    const row = instructions.addRow([name, description]);
    row.eachCell((cell) => applyDataStyle(cell));
    row.height = name === '已读不回偏好' ? 42 : 30;
  });

  const data = workbook.addWorksheet(PROMPT_EXCEL_DATA_SHEET);
  data.columns = [
    { header: PROMPT_EXCEL_HEADERS[0], key: 'npcId', width: 16 },
    { header: PROMPT_EXCEL_HEADERS[1], key: 'scope', width: 18 },
    { header: PROMPT_EXCEL_HEADERS[2], key: 'channelId', width: 18 },
    { header: PROMPT_EXCEL_HEADERS[3], key: 'prompt', width: 86 },
  ];
  data.getRow(1).eachCell((cell) => applyHeaderStyle(cell));
  data.getRow(1).height = 28;
  const rows = promptRowsForConfig(config);
  rows.forEach((item) => {
    const row = data.addRow([
      npcNameFor(item.npcId),
      PROMPT_EXCEL_SCOPE_LABELS[item.scope as PromptExcelScope],
      item.scope.startsWith('role_') ? '' : channelLabelFor(item.channelId),
      item.prompt,
    ]);
    row.eachCell((cell) => applyDataStyle(cell));
    row.height = 54;
  });
  data.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  data.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(rows.length + 1, 1), column: PROMPT_EXCEL_HEADERS.length },
  };
  const promptTypeValues = [...PROMPT_EXCEL_PROMPT_TYPE_LABELS];
  for (let row = 2; row <= rows.length + 16; row += 1) {
    data.getCell(row, 2).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: [`"${promptTypeValues.join(',')}"`],
      showErrorMessage: true,
      errorTitle: '提示词用途无效',
      error: `请选择：${promptTypeValues.join('、')}`,
    };
    data.getCell(row, 3).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${PROMPT_EXCEL_CHANNEL_LABELS.join(',')}"`],
      showErrorMessage: true,
      errorTitle: '交流方式无效',
      error: `请选择：${PROMPT_EXCEL_CHANNEL_LABELS.join('、')}`,
    };
  }

  return workbook;
}

export async function exportPromptExcel(config: ProjectOnePromptConfig): Promise<Buffer> {
  const output = await createPromptExcelWorkbook(config).xlsx.writeBuffer();
  return Buffer.from(output);
}

function addIssue(
  errors: PromptExcelValidationIssue[],
  message: string,
  options: Omit<PromptExcelValidationIssue, 'message'> = {},
): void {
  errors.push({ message, ...options });
}

function promptWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  return workbook.getWorksheet(PROMPT_EXCEL_DATA_SHEET);
}

function readCell(
  worksheet: ExcelJS.Worksheet,
  headerMap: Map<PromptExcelColumn, number>,
  key: PromptExcelColumn,
  rowNumber: number,
): string {
  const columnNumber = headerMap.get(key);
  return columnNumber === undefined ? '' : cellText(worksheet.getRow(rowNumber).getCell(columnNumber).value);
}

function parseHeader(
  worksheet: ExcelJS.Worksheet,
  errors: PromptExcelValidationIssue[],
): Map<PromptExcelColumn, number> {
  const headerMap = new Map<PromptExcelColumn, number>();
  const headerFamilies = new Set<PromptExcelHeaderFamily>();
  const headerRow = worksheet.getRow(1);
  const columnCount = Math.max(headerRow.cellCount, worksheet.actualColumnCount);
  for (let columnNumber = 1; columnNumber <= columnCount; columnNumber += 1) {
    const label = cellText(headerRow.getCell(columnNumber).value).trim();
    if (!label) continue;
    if (CURRENT_HEADER_SET.has(label)) headerFamilies.add('current');
    if (LEGACY_HEADER_SET.has(label)) headerFamilies.add('legacy');
    const key = HEADER_ALIASES.get(label);
    if (!key) {
      addIssue(errors, `未知表头“${label}”。请保留系统导出的四列表头。`, {
        field: label,
        code: 'UNKNOWN_HEADER',
      });
      continue;
    }
    if (headerMap.has(key)) {
      addIssue(errors, `“${label}”对应的表头重复出现。`, {
        field: key,
        code: 'DUPLICATE_HEADER',
      });
      continue;
    }
    headerMap.set(key, columnNumber);
  }
  if (headerFamilies.size > 1) {
    addIssue(errors, '不能混用新旧两套表头，请保留同一套四列表头。', {
      field: 'table',
      code: 'MIXED_HEADER',
    });
  }
  for (const key of PROMPT_EXCEL_COLUMNS) {
    if (!headerMap.has(key)) {
      const expectedHeader = PROMPT_EXCEL_HEADERS[PROMPT_EXCEL_COLUMNS.indexOf(key)];
      addIssue(errors, `缺少表头“${expectedHeader}”。`, {
        field: expectedHeader,
        code: 'MISSING_HEADER',
      });
    }
  }
  return headerMap;
}

function validateDataColumns(
  worksheet: ExcelJS.Worksheet,
  headerMap: Map<PromptExcelColumn, number>,
  rowNumber: number,
  errors: PromptExcelValidationIssue[],
): void {
  const row = worksheet.getRow(rowNumber);
  const maxColumn = Math.max(row.cellCount, worksheet.actualColumnCount);
  const knownColumns = new Set(headerMap.values());
  for (let columnNumber = 1; columnNumber <= maxColumn; columnNumber += 1) {
    if (knownColumns.has(columnNumber)) continue;
    if (!isBlank(row.getCell(columnNumber).value)) {
      addIssue(errors, '数据行包含未定义的列值；请不要在四列表格外填写内容。', {
        row: rowNumber,
        field: 'table',
        code: 'UNKNOWN_COLUMN_VALUE',
      });
    }
  }
}

function validateRow(
  item: PromptExcelRow,
  rowNumber: number,
  errors: PromptExcelValidationIssue[],
  seenKeys: Map<string, number>,
): void {
  if (!NPC_ID_SET.has(item.npcId)) {
    addIssue(errors, `未知人物“${item.npcId}”。请使用表格中已有的五位人物姓名。`, {
      row: rowNumber,
      field: 'npcId',
      code: 'UNKNOWN_NPC_ID',
    });
  }
  if (!SCOPE_SET.has(item.scope)) {
    addIssue(errors, `提示词用途“${item.scope}”无效，请填写“人物总提示词”或“渠道补充”。`, {
      row: rowNumber,
      field: 'scope',
      code: 'INVALID_SCOPE',
    });
  }

  if (item.scope.startsWith('role_')) {
    if (item.channelId !== '') {
      addIssue(errors, '“人物总提示词”行的交流方式必须留空。', {
        row: rowNumber,
        field: 'channelId',
        code: 'ROLE_CHANNEL_NOT_EMPTY',
      });
    }
  } else if (item.scope === 'channel') {
    if (!item.channelId) {
      addIssue(errors, '“渠道补充”行必须填写交流方式。', {
        row: rowNumber,
        field: 'channelId',
        code: 'CHANNEL_ID_REQUIRED',
      });
    } else if (!CHANNEL_ID_SET.has(item.channelId)) {
      addIssue(errors, `未知交流方式“${item.channelId}”。请从下拉选项中选择。`, {
        row: rowNumber,
        field: 'channelId',
        code: 'UNKNOWN_CHANNEL_ID',
      });
    }
  }

  if (item.prompt.length > PROMPT_EXCEL_MAX_TEXT_LENGTH) {
    addIssue(errors, `提示词长度不能超过 ${PROMPT_EXCEL_MAX_TEXT_LENGTH} 个字符。`, {
      row: rowNumber,
      field: 'prompt',
      code: 'PROMPT_TOO_LONG',
    });
  }

  if (NPC_ID_SET.has(item.npcId) && SCOPE_SET.has(item.scope)) {
    const duplicatePart = item.scope === 'channel' ? item.channelId : '';
    const key = `${item.npcId}\u0000${item.scope}\u0000${duplicatePart}`;
    const previousRow = seenKeys.get(key);
    if (previousRow !== undefined) {
      const target = item.scope === 'channel'
        ? `${npcNameFor(item.npcId)}的“${channelLabelFor(item.channelId)}”`
        : `${npcNameFor(item.npcId)}的“${PROMPT_EXCEL_SCOPE_LABELS[item.scope as PromptExcelScope]}”`;
      addIssue(errors, `重复行：“${target}”已在第 ${previousRow} 行填写。`, {
        row: rowNumber,
        field: 'npcId',
        code: 'DUPLICATE_ROW',
      });
    } else {
      seenKeys.set(key, rowNumber);
    }
  }
}

function editableFromRows(rows: PromptExcelRow[]): PromptExcelEditableConfig {
  const npcRolePrompts: Record<string, NpcRolePromptProfile> = {};
  const npcChannelExceptions: Record<string, Record<string, string>> = {};
  for (const npcId of PROMPT_EXCEL_NPC_IDS) {
    const roleRows = rows.filter((item) => item.npcId === npcId && item.scope.startsWith('role_'));
    const base = roleRows.find((item) => item.scope === 'role_base')?.prompt ?? '';
    const profile = createNpcRolePromptProfile(base);
    for (const item of roleRows) {
      const field = item.scope.slice('role_'.length) as 'base' | 'low' | 'medium' | 'high';
      profile[field] = item.prompt;
    }
    npcRolePrompts[npcId] = profile;
  }
  for (const item of rows) {
    if (item.scope.startsWith('role_')) continue;
    npcChannelExceptions[item.npcId] ??= {};
    npcChannelExceptions[item.npcId][item.channelId] = item.prompt;
  }
  return { npcRolePrompts, npcChannelExceptions };
}

export async function parsePromptExcel(input: Buffer | Uint8Array): Promise<PromptExcelImportResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    const arrayBuffer = new Uint8Array(input).buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
    await workbook.xlsx.load(arrayBuffer);
  } catch {
    throw new PromptExcelRequestError('上传文件不是有效的 .xlsx 工作簿。', 400, 'INVALID_XLSX');
  }

  const worksheet = promptWorksheet(workbook);
  if (!worksheet) {
    return {
      ok: false,
      sheetName: PROMPT_EXCEL_DATA_SHEET,
      rows: [],
      errors: [{ message: `未找到“${PROMPT_EXCEL_DATA_SHEET}”工作表。`, code: 'MISSING_SHEET' }],
      editable: null,
      summary: { totalRows: 0, validRows: 0, errorCount: 1 },
    };
  }

  const errors: PromptExcelValidationIssue[] = [];
  const headerMap = parseHeader(worksheet, errors);
  const rows: PromptExcelRow[] = [];
  const rowNumbers: number[] = [];
  const rowErrorNumbers = new Set<number>();
  const seenKeys = new Map<string, number>();

  for (let rowNumber = 2; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (rowIsBlank(row)) continue;
    if (rows.length >= PROMPT_EXCEL_MAX_ROWS) {
      throw new PromptExcelRequestError(`数据行数不能超过 ${PROMPT_EXCEL_MAX_ROWS} 行。`, 413, 'ROW_LIMIT_EXCEEDED');
    }
    const errorsBefore = errors.length;
    validateDataColumns(worksheet, headerMap, rowNumber, errors);
    const item: PromptExcelRow = {
      npcId: normalizeNpcId(readCell(worksheet, headerMap, 'npcId', rowNumber).trim()),
      scope: normalizeScope(readCell(worksheet, headerMap, 'scope', rowNumber).trim()),
      channelId: normalizeChannelId(readCell(worksheet, headerMap, 'channelId', rowNumber).trim()),
      // 提示词正文保留空格和换行，保证导入导出不改变内容。
      prompt: readCell(worksheet, headerMap, 'prompt', rowNumber),
    };
    rows.push(item);
    rowNumbers.push(rowNumber);
    validateRow(item, rowNumber, errors, seenKeys);
    if (errors.length > errorsBefore) rowErrorNumbers.add(rowNumber);
  }

  const roleFieldsByNpc = new Map<string, Set<string>>();
  const hasNewTierRows = rows.some((item) => item.scope === 'role_low' || item.scope === 'role_medium' || item.scope === 'role_high');
  for (const item of rows) {
    if (item.scope.startsWith('role_') && NPC_ID_SET.has(item.npcId)) {
      const fields = roleFieldsByNpc.get(item.npcId) ?? new Set<string>();
      fields.add(item.scope);
      roleFieldsByNpc.set(item.npcId, fields);
    }
  }
  for (const npcId of PROMPT_EXCEL_NPC_IDS) {
    const fields = roleFieldsByNpc.get(npcId) ?? new Set<string>();
    if (!fields.has('role_base')) {
      addIssue(errors, `缺少人物“${npcNameFor(npcId)}”的“人物基础提示词”行。五个人物都必须各有基础提示词。`, {
        field: 'npcId',
        code: 'MISSING_ROLE_ROW',
      });
    }
    // A wholly old workbook has only the legacy single role row for every
    // person and receives the default tier text in editableFromRows. Once any
    // new tier row appears, require a complete tier set for all five people.
    if (hasNewTierRows) {
      for (const tier of ['role_low', 'role_medium', 'role_high']) {
        if (!fields.has(tier)) addIssue(errors, `缺少人物“${npcNameFor(npcId)}”的“${PROMPT_EXCEL_SCOPE_LABELS[tier as PromptExcelScope]}”行。`, { field: 'npcId', code: 'MISSING_ROLE_TIER_ROW' });
      }
    }
  }

  // 表头错误没有行号；只有无任何错误时才允许应用导入结果。
  const validRows = rowNumbers.filter((rowNumber) => !rowErrorNumbers.has(rowNumber)).length;
  const ok = errors.length === 0;
  return {
    ok,
    sheetName: worksheet.name,
    rows,
    errors,
    editable: ok ? editableFromRows(rows) : null,
    summary: {
      totalRows: rows.length,
      validRows,
      errorCount: errors.length,
    },
  };
}
