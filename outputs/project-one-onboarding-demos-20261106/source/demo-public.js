'use strict';

const PUBLIC_NOTICE = '本页内容为虚构演示资料，人物与项目均为示例。';

// These twelve scenario overrides are reviewed public-facing copy. Only the
// named facts and source detail rows may appear in the generated brief.
const PUBLIC_SCENARIOS = {
  'manufacturing+management': {
    description: '制造企业希望改善订单交付、生产计划与采购之间的信息衔接，让跨部门协作进度更清楚。',
    overview: '公开项目聚焦订单交付跟踪、生产计划协同和经营分析，按阶段推进。',
    goals: ['订单与计划协同', '跨部门流程留痕', '分阶段上线'],
    facts: [
      { label: '预算口径', value: '公告估算 480–620 万元', note: '公开预算估算' },
      { label: '计划节点', value: '2027 年 3 月启动采购 · 年内分批试运行', note: '公开计划节点' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '本期拟先覆盖订单交付跟踪、计划协同与经营看板；设备自动化改造不在当前公开范围。',
        label: '建设范围',
        value: '本期拟先覆盖订单交付跟踪、计划协同与经营看板；设备自动化改造不在当前公开范围。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '支持销售订单、生产计划和采购进度的状态关联，保留权限分层与操作审计。',
        label: '公开需求',
        value: '支持销售订单、生产计划和采购进度的状态关联，保留权限分层与操作审计。',
      },
    ],
  },
  'manufacturing+iot': {
    description: '制造企业计划在关键产线上开展设备运维数字化试点，统一查看设备状态、异常告警和维修任务。',
    overview: '公开项目以设备状态只读采集、异常告警与工单闭环为目标，生产控制保持独立。',
    goals: ['关键设备接入试点', '报警与工单闭环', '不影响连续生产'],
    facts: [
      { label: '预算口径', value: '公告估算 260–360 万元', note: '公开预算估算' },
      { label: '计划节点', value: '2027 年二季度完成试点验收', note: '公开计划节点' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '本期覆盖设备状态采集、异常告警、点检与维修任务；控制指令下发和生产控制改造不在公开范围。',
        label: '建设范围',
        value: '本期覆盖设备状态采集、异常告警、点检与维修任务；控制指令下发和生产控制改造不在公开范围。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '支持只读采集、设备台账关联、告警分级和维修工单留痕；关键数据需保留访问审计。',
        label: '公开需求',
        value: '支持只读采集、设备台账关联、告警分级和维修工单留痕；关键数据需保留访问审计。',
      },
    ],
  },
  'healthcare+data_ai': {
    description: '医院希望围绕门诊运行、床位周转和物资使用开展运营分析试点，统一常用指标口径并减少手工汇总。',
    overview: '公开项目聚焦运营指标管理和分析查询，数据使用遵循院内授权与权限审计要求，不用于临床诊疗决策。',
    goals: ['统一运营指标口径', '院内数据受控使用', '先小范围验证'],
    facts: [
      { label: '预算口径', value: '公告估算 180–280 万元', note: '公开预算估算' },
      { label: '计划节点', value: '2027 年上半年完成试点验证', note: '公开计划节点' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '首期提供数据口径管理、运营看板和可追溯的分析查询；不用于诊疗建议、患者分诊或自动化临床决策。',
        label: '建设范围',
        value: '首期提供数据口径管理、运营看板和可追溯的分析查询；不用于诊疗建议、患者分诊或自动化临床决策。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '数据使用须符合院方授权、最小权限和审计要求；敏感字段按医院规则处理。',
        label: '公开需求',
        value: '数据使用须符合院方授权、最小权限和审计要求；敏感字段按医院规则处理。',
      },
    ],
  },
  'healthcare+infrastructure': {
    description: '医院拟扩展影像归档与备份能力，缓解检查数据增长带来的压力，并完善恢复演练和容量管理。',
    overview: '公开项目聚焦影像存储扩容、备份策略完善和恢复演练，保障院内影像业务连续运行。',
    goals: ['扩展影像存储能力', '验证备份恢复流程', '保障业务连续性'],
    facts: [
      { label: '预算口径', value: '公告估算 320–460 万元', note: '公开预算估算' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '本期考虑存储扩容、备份策略完善、容量告警和恢复演练；不涉及更换影像诊断工作站。',
        label: '建设范围',
        value: '本期考虑存储扩容、备份策略完善、容量告警和恢复演练；不涉及更换影像诊断工作站。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '需支持院内受控部署、访问权限审计、分层存储管理和既有 PACS 业务连续性。',
        label: '公开需求',
        value: '方案需支持院内受控部署、权限审计、分层存储与影像业务连续运行。',
      },
    ],
  },
  'education+infrastructure': {
    description: '学校计划提升校级计算、存储和网络承载能力，以支持教学平台在学期高峰稳定运行。',
    overview: '公开项目聚焦资源池扩容、校区网络承载和统一运维监测，按教学安排分阶段实施。',
    goals: ['资源统一纳管', '支撑教学高峰', '分校区平滑迁移'],
    facts: [
      { label: '预算口径', value: '公告估算 520–760 万元', note: '公开预算估算' },
      { label: '计划节点', value: '目标 2027 年暑期完成主要变更', note: '公开计划节点' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '本期关注计算/存储资源池、校区网络承载及统一运维监测；教学业务软件改造暂不包含。',
        label: '建设范围',
        value: '本期关注计算/存储资源池、校区网络承载及统一运维监测；教学业务软件改造暂不包含。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '需兼顾既有教学系统兼容、统一权限管理、资源使用监测和故障告警。',
        label: '公开需求',
        value: '需兼顾既有教学系统兼容、统一权限管理、资源使用监测和故障告警。',
      },
    ],
  },
  'education+workplace': {
    description: '学校希望改善部分会议与教学空间的预约、状态查看和协作体验，减少排期冲突并便于设备维护。',
    overview: '公开项目聚焦空间预约、协作设备改造和使用状态管理，按教学安排分区分批实施。',
    goals: ['空间预约透明', '设备状态可见', '分区分批施工'],
    facts: [
      { label: '预算口径', value: '公告估算 150–230 万元', note: '公开预算估算' },
      { label: '计划节点', value: '2027 年暑期完成第一批改造', note: '公开计划节点' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '本期规划预约信息展示、会议协作设备更新和使用状态管理；全校一卡通改造不在公开范围。',
        label: '建设范围',
        value: '本期规划预约信息展示、会议协作设备更新和使用状态管理；全校一卡通改造不在公开范围。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '预约信息需与学校既有身份体系衔接，设备控制应保留人工操作方式和管理审计。',
        label: '公开需求',
        value: '预约服务需支持身份管理，设备操作保留人工方式并纳入管理审计。',
      },
    ],
  },
  'energy+iot': {
    description: '水务运营单位计划开展泵站设备运行监测试点，集中查看状态、告警和巡检记录，减少班组交接遗漏。',
    overview: '公开项目包括只读状态采集、分级告警和巡检关联；生产控制系统保持独立。',
    goals: ['泵站状态集中查看', '告警与巡检关联', '生产控制保持独立'],
    facts: [
      { label: '预算口径', value: '公告估算 220–340 万元', note: '公开预算估算' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '包括状态只读采集、分级告警、巡检任务关联和运行报表；远程下发控制指令不在本项目范围。',
        label: '建设范围',
        value: '包括状态只读采集、分级告警、巡检任务关联和运行报表；远程下发控制指令不在本项目范围。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '生产控制系统保持原有安全边界，采集链路需可审计、异常可追踪且支持断网恢复。',
        label: '公开需求',
        value: '生产控制系统保持原有安全边界，采集链路需可审计、异常可追踪且支持断网恢复。',
      },
    ],
  },
  'energy+security': {
    description: '能源服务单位拟梳理生产控制网络资产边界及告警处置流程，分阶段开展监测与整改验证。',
    overview: '公开范围包括边界梳理、被动安全监测和整改建议验证；相关测试和变更须按授权及审批要求执行。',
    goals: ['先梳理资产边界', '监测与处置流程试点', '变更需审批验证'],
    facts: [
      { label: '预算口径', value: '公告估算 300–450 万元', note: '公开预算估算' },
      { label: '计划节点', value: '2027 年三季度前完成阶段验收', note: '公开计划节点' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '公开范围包括资产边界梳理、被动安全监测和整改建议验证；生产控制逻辑变更不在公开范围。',
        label: '建设范围',
        value: '公开范围包括资产边界梳理、被动安全监测和整改建议验证；生产控制逻辑变更不在公开范围。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '方案需说明旁路监测、访问权限、日志留存、误报复核和安全事件升级机制。',
        label: '公开需求',
        value: '方案需兼顾监测安全、访问控制、日志审计、误报复核和安全事件处置。',
      },
    ],
  },
  'logistics+iot': {
    description: '物流企业希望围绕仓内设备状态和货物流转事件建立统一可视化与异常跟踪，提升跨班组协作效率。',
    overview: '公开项目面向仓储设备运维和货物流转协同，支持异常处理留痕与离线数据补传。',
    goals: ['仓内作业事件可见', '设备异常可追踪', '旺季运行不中断'],
    facts: [
      { label: '预算口径', value: '公告估算 240–380 万元', note: '公开预算估算' },
      { label: '计划节点', value: '目标 2027 年四季度完成试点', note: '公开计划节点' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '首期包括关键输送设备状态、货物流转事件和异常工单关联；自动分拣控制改造不在范围内。',
        label: '建设范围',
        value: '首期包括关键输送设备状态、货物流转事件和异常工单关联；自动分拣控制改造不在范围内。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '需支持设备状态与业务事件关联、离线数据补传、班组权限和异常留痕。',
        label: '公开需求',
        value: '需支持设备状态与业务事件关联、离线数据补传、班组权限和异常留痕。',
      },
    ],
  },
  'finance+security': {
    description: '银行拟完善分支机构业务数据备份策略与恢复演练，统一记录演练过程，提升故障后的恢复准备效率。',
    overview: '公开项目关注备份策略管理、恢复演练和审计留痕，业务系统仍由行内团队负责。',
    goals: ['备份策略一致可查', '恢复演练有记录', '符合行内安全审批'],
    facts: [
      { label: '预算口径', value: '公告估算 280–420 万元', note: '公开预算估算' },
      { label: '计划节点', value: '目标 2027 年三季度完成首轮演练', note: '公开计划节点' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '公开范围为备份策略管理、恢复演练记录和审计材料归档；核心业务系统替换不在本项目范围。',
        label: '建设范围',
        value: '公开范围为备份策略管理、恢复演练记录和审计材料归档；核心业务系统替换不在本项目范围。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '部署与访问须符合银行网络分区、最小权限、操作审计和介质管理规范。',
        label: '公开需求',
        value: '部署与访问须符合银行网络分区、最小权限、操作审计和介质管理规范。',
      },
    ],
  },
  'retail+management': {
    description: '连锁企业希望改善门店补货、促销计划和总部经营分析的协作节奏，先规范流程再分批推广。',
    overview: '公开项目聚焦经营流程协同与管理数据分析，支持区域计划和补货状态跟踪。',
    goals: ['区域计划协同', '补货状态可追踪', '门店分批推广'],
    facts: [
      { label: '预算口径', value: '公告估算 210–330 万元', note: '公开预算估算' },
      { label: '计划节点', value: '计划 2027 年二季度起分批上线', note: '公开计划节点' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '本期关注流程协同和经营看板；POS 收银、商品主数据与供应商结算系统不在替换范围。',
        label: '建设范围',
        value: '本期聚焦流程协同和经营看板，保留现有门店交易与商品管理流程。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '需要按总部、区域、门店角色分级查看，支持促销计划留痕和补货状态跟踪。',
        label: '公开需求',
        value: '需要按总部、区域、门店角色分级查看，支持促销计划留痕和补货状态跟踪。',
      },
    ],
  },
  'government+management': {
    description: '区级政务服务机构拟优化跨窗口事项协同和进度跟踪，减少人工催办和重复登记。',
    overview: '公开项目聚焦内部协同、进度看板与统计报表，不替换全区统一政务服务事项平台。',
    goals: ['事项进度统一查看', '跨部门协同留痕', '复用既有政务系统'],
    facts: [
      { label: '预算口径', value: '公告估算 360–520 万元', note: '公开预算估算' },
      { label: '计划节点', value: '目标 2027 年四季度前试运行', note: '公开计划节点' },
    ],
    details: [
      {
        title: '业务范围',
        sourceSection: '业务现状',
        sourceLabel: '建设范围',
        sourceValue: '本期考虑内部任务协同、进度看板与统计报表；不替换全区统一政务服务事项平台。',
        label: '建设范围',
        value: '本期考虑内部任务协同、进度看板与统计报表；不替换全区统一政务服务事项平台。',
      },
      {
        title: '技术需求',
        sourceSection: '技术需求',
        sourceLabel: '公开需求',
        sourceValue: '需符合政务云部署、安全分区、权限审计、数据最小化和业务连续性要求。',
        label: '公开需求',
        value: '需符合政务云部署、安全分区、权限审计、数据最小化和业务连续性要求。',
      },
    ],
  },
};

const EXPECTED_SCENARIO_KEYS = Object.keys(PUBLIC_SCENARIOS).sort();
const CATALOG_FIELDS = ['id', 'label', 'description', 'icon'];
const SCENARIO_FIELDS = [
  'id',
  'industryId',
  'businessId',
  'projectName',
  'clientName',
  'description',
  'overview',
  'goals',
  'facts',
  'details',
  'peopleRoles',
];

function assertObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
}

function assertString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${path} must be a non-empty string`);
  }
  return value;
}

function projectCatalog(items, path) {
  if (!Array.isArray(items)) throw new TypeError(`${path} must be an array`);
  return items.map((item, index) => {
    assertObject(item, `${path}[${index}]`);
    return Object.fromEntries(CATALOG_FIELDS.map((field) => [
      field,
      assertString(item[field], `${path}[${index}].${field}`),
    ]));
  });
}

function projectPeople(items) {
  if (!Array.isArray(items)) throw new TypeError('people must be an array');
  return items.map((person, index) => {
    assertObject(person, `people[${index}]`);
    return {
      id: assertString(person.id, `people[${index}].id`),
      name: assertString(person.name, `people[${index}].name`),
      photoAsset: assertString(person.photoAsset, `people[${index}].photoAsset`),
    };
  });
}

function assertKnownStatuses(rawScenario, key) {
  if (!Array.isArray(rawScenario.details)) throw new TypeError(`scenarios.${key}.details must be an array`);
  for (const [sectionIndex, section] of rawScenario.details.entries()) {
    assertObject(section, `scenarios.${key}.details[${sectionIndex}]`);
    if (!Array.isArray(section.items)) {
      throw new TypeError(`scenarios.${key}.details[${sectionIndex}].items must be an array`);
    }
    for (const [itemIndex, item] of section.items.entries()) {
      assertObject(item, `scenarios.${key}.details[${sectionIndex}].items[${itemIndex}]`);
      if (item.status !== '公开' && item.status !== '待沟通') {
        throw new Error(`scenarios.${key}.details[${sectionIndex}].items[${itemIndex}] has an unknown status`);
      }
    }
  }
}

function findUnique(items, predicate, path) {
  const matches = items.filter(predicate);
  if (matches.length !== 1) throw new Error(`${path} must match exactly one approved source item`);
  return matches[0];
}

function projectFacts(rawScenario, approved, key) {
  if (!Array.isArray(rawScenario.facts)) throw new TypeError(`scenarios.${key}.facts must be an array`);
  return approved.facts.map((fact, index) => {
    const sourceFact = findUnique(
      rawScenario.facts,
      (candidate) => candidate && candidate.label === fact.label,
      `scenarios.${key}.facts[${index}]`,
    );
    if (sourceFact.value !== fact.value) {
      throw new Error(`scenarios.${key}.facts[${index}] no longer matches approved public content`);
    }
    return { label: fact.label, value: fact.value, note: fact.note };
  });
}

function projectDetails(rawScenario, approved, key) {
  const projectedSections = [];
  for (const item of approved.details) {
    const sourceSection = findUnique(
      rawScenario.details,
      (section) => section.title === item.sourceSection,
      `scenarios.${key}.details.${item.sourceSection}`,
    );
    const sourceItem = findUnique(
      sourceSection.items,
      (candidate) => candidate.label === item.sourceLabel,
      `scenarios.${key}.details.${item.sourceLabel}`,
    );
    if (sourceItem.status !== '公开') {
      throw new Error(`scenarios.${key}.details.${item.sourceLabel} is no longer public`);
    }
    if (sourceItem.value !== item.sourceValue) {
      throw new Error(`scenarios.${key}.details.${item.sourceLabel} no longer matches approved public content`);
    }

    let projectedSection = projectedSections.find((section) => section.title === item.title);
    if (!projectedSection) {
      projectedSection = { title: item.title, items: [] };
      projectedSections.push(projectedSection);
    }
    projectedSection.items.push({ label: item.label, value: item.value, status: '公开' });
  }
  return projectedSections.filter((section) => section.items.length > 0);
}

function projectScenario(rawScenario, key, peopleIds) {
  const approved = PUBLIC_SCENARIOS[key];
  assertObject(rawScenario, `scenarios.${key}`);
  assertKnownStatuses(rawScenario, key);

  const [industryId, businessId] = key.split('+');
  if (rawScenario.industryId !== industryId || rawScenario.businessId !== businessId) {
    throw new Error(`scenarios.${key} category mapping does not match its key`);
  }
  if (!Array.isArray(rawScenario.goals)
    || rawScenario.goals.length !== approved.goals.length
    || rawScenario.goals.some((goal, index) => goal !== approved.goals[index])) {
    throw new Error(`scenarios.${key}.goals no longer match approved public content`);
  }
  assertObject(rawScenario.peopleRoles, `scenarios.${key}.peopleRoles`);

  const peopleRoles = Object.fromEntries(peopleIds.map((personId) => [
    personId,
    assertString(rawScenario.peopleRoles[personId], `scenarios.${key}.peopleRoles.${personId}`),
  ]));

  return {
    id: assertString(rawScenario.id, `scenarios.${key}.id`),
    industryId,
    businessId,
    projectName: assertString(rawScenario.projectName, `scenarios.${key}.projectName`),
    clientName: assertString(rawScenario.clientName, `scenarios.${key}.clientName`),
    description: approved.description,
    overview: approved.overview,
    goals: approved.goals.slice(),
    facts: projectFacts(rawScenario, approved, key),
    details: projectDetails(rawScenario, approved, key),
    peopleRoles,
  };
}

function toPublicDemoData(raw) {
  assertObject(raw, 'raw');
  assertObject(raw.scenarios, 'raw.scenarios');

  const actualKeys = Object.keys(raw.scenarios).sort();
  if (actualKeys.length !== EXPECTED_SCENARIO_KEYS.length
    || actualKeys.some((key, index) => key !== EXPECTED_SCENARIO_KEYS[index])) {
    throw new Error('raw.scenarios does not match the audited public scenario set');
  }

  const people = projectPeople(raw.people);
  const peopleIds = people.map((person) => person.id);
  const scenarios = Object.fromEntries(EXPECTED_SCENARIO_KEYS.map((key) => [
    key,
    projectScenario(raw.scenarios[key], key, peopleIds),
  ]));

  return {
    version: '2026-11-06-public-demo-v1',
    notice: PUBLIC_NOTICE,
    industries: projectCatalog(raw.industries, 'industries'),
    businesses: projectCatalog(raw.businesses, 'businesses'),
    people,
    scenarios,
  };
}

module.exports = toPublicDemoData;
