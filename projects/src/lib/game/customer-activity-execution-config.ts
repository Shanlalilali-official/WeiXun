import { z } from 'zod';
import type { CustomerActivityType } from './customer-activities';

const activityTypes = [
  'technical_meeting',
  'case_site_visit',
  'company_visit',
  'hospitality',
] as const satisfies readonly CustomerActivityType[];

const optionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(320),
  supportDelta: z.number().int().min(-5).max(4),
  pleasureDelta: z.number().int().min(-8).max(6),
}).strict();

export const activityQuestionSchema = z.object({
  id: z.string().trim().min(1).max(100).refine(
    (id) => !['__proto__', 'constructor', 'prototype'].includes(id),
    'quiz question ID cannot use a reserved object property name',
  ),
  title: z.string().trim().min(1).max(600),
  options: z.array(optionSchema).length(4),
}).strict().superRefine((question, context) => {
  const ids = question.options.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'quiz option IDs must be unique within a question' });
  }
});

const activityQuestionBankSchema = z.array(activityQuestionSchema).length(3);

const questionBanksSchema = z.object({
  technical_meeting: activityQuestionBankSchema,
  case_site_visit: activityQuestionBankSchema,
  company_visit: activityQuestionBankSchema,
  hospitality: activityQuestionBankSchema,
}).strict();

const limitsSchema = z.object({
  supportMin: z.number().int().min(-5).max(0),
  supportMax: z.number().int().min(0).max(4),
  pleasureMin: z.number().int().min(-8).max(0),
  pleasureMax: z.number().int().min(0).max(6),
  dimensionMin: z.number().int().min(-3).max(0),
  dimensionMax: z.number().int().min(0).max(3),
}).strict();

const weightsSchema = z.object({
  plan: z.number().min(0).max(1).multipleOf(0.01),
  quiz: z.number().min(0).max(1).multipleOf(0.01),
}).strict().refine(({ plan, quiz }) => plan > 0 || quiz > 0, {
  message: 'plan and quiz weights cannot both be zero',
});

export const activityExecutionConfigSchema = z.object({
  evaluationProvider: z.enum(['llm', 'jev']).default('llm'),
  quizDurationSeconds: z.number().int().min(30).max(600),
  questionBanks: questionBanksSchema,
  hospitalityNonAlcoholQuestion: activityQuestionSchema.nullable(),
  aiInstructions: z.string().trim().min(1).max(8_000),
  limits: limitsSchema,
  weights: weightsSchema,
}).strict().superRefine((config, context) => {
  const questionIds = [
    ...activityTypes.flatMap((type) => config.questionBanks[type].map(({ id }) => id)),
    ...(config.hospitalityNonAlcoholQuestion ? [config.hospitalityNonAlcoholQuestion.id] : []),
  ];
  if (new Set(questionIds).size !== questionIds.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['questionBanks'], message: 'quiz question IDs must be unique' });
  }
});

export type ActivityQuestion = z.infer<typeof activityQuestionSchema>;
export type ActivityExecutionConfig = z.infer<typeof activityExecutionConfigSchema>;

/** Returns an updated snapshot while preserving all shared questions and evaluation rules. */
export function withActivityExecutionProvider(
  config: ActivityExecutionConfig,
  evaluationProvider: ActivityExecutionConfig['evaluationProvider'],
): ActivityExecutionConfig {
  return { ...config, evaluationProvider };
}

function options(
  best: string,
  acceptable: string,
  weak: string,
  harmful: string,
  deltas: [[number, number], [number, number], [number, number], [number, number]] = [[1, 1], [1, 0], [0, 0], [-1, -1]],
): ActivityQuestion['options'] {
  return [best, acceptable, weak, harmful].map((text, index) => ({
    id: `option-${index + 1}`,
    text,
    supportDelta: deltas[index][0],
    pleasureDelta: deltas[index][1],
  }));
}

function question(
  id: string,
  title: string,
  choices: ActivityQuestion['options'],
): ActivityQuestion {
  return { id, title, options: choices };
}

const hypothetical = (text: string) => `情境推演（假设）：${text}`;

export const DEFAULT_ACTIVITY_EXECUTION_CONFIG: ActivityExecutionConfig = activityExecutionConfigSchema.parse({
  quizDurationSeconds: 120,
  questionBanks: {
    technical_meeting: [
      question('technical-preparation', hypothetical('交流前，客户还没确认参会人员和具体问题，你会怎样准备？'), options(
        '先确认客户想解决的问题、参会角色与时间，再按共同确认的范围准备议题。',
        '先发一个简短议程和可选时间，请客户补充最关心的技术问题。',
        '只准备通用产品介绍，等客户到场后再看情况。',
        '不确认需求就承诺现场一定能解决全部接口问题。',
        [[1, 1], [1, 0], [0, -1], [-1, -2]],
      )),
      question('technical-discussion', hypothetical('现场有人提出暂时无法核实的兼容性问题，你会怎样回应？'), options(
        '先复述问题并说明核实边界，记录所需信息和负责人，约定后续答复。',
        '邀请熟悉该模块的同事补充，仍不确定的部分标记待核验。',
        '先跳过问题，继续讲准备好的内容。',
        '为显得专业，直接保证当前版本完全兼容。',
        [[1, 1], [1, 0], [0, -1], [-1, -2]],
      )),
      question('technical-follow-up', hypothetical('交流结束后，客户还需要内部评估，你会怎样跟进？'), options(
        '发送经双方核对的要点、待确认事项和联系人，并询问合适的下一步。',
        '发送资料和简短感谢，说明可按客户节奏继续沟通。',
        '只发整套资料，不区分客户关心的内容。',
        '未经客户确认就把讨论结论写成已达成的采购承诺。',
        [[1, 1], [1, 0], [0, -1], [-1, -2]],
      )),
    ],
    case_site_visit: [
      question('case-preparation', hypothetical('客户希望了解类似项目，你会怎样筹备案例现场交流？'), options(
        '确认客户关注点、现场接待授权和可公开范围，再协调合适的讲解人。',
        '先确认时间和人数，并说明案例细节要以现场方许可为准。',
        '挑一个方便的案例地点，其他安排等出发后再说。',
        '未经同意先承诺展示客户项目资料和敏感数据。',
        [[1, 1], [1, 0], [0, -1], [-1, -2]],
      )),
      question('case-visit', hypothetical('讲解现场出现与客户情况不同的实施条件，你会怎样处理？'), options(
        '讲清可比之处和差异条件，邀请客户结合自身场景提问。',
        '先请现场负责人介绍实际做法，再标出不能直接类比的部分。',
        '回避差异，只强调案例效果。',
        '把案例结果保证为客户项目也能达到的结果。',
        [[1, 1], [1, 0], [0, -1], [-1, -2]],
      )),
      question('case-follow-up', hypothetical('参观后客户要整理内部问题，你会怎样跟进？'), options(
        '整理经现场方允许分享的要点，列出仍待核实的问题并约定对接人。',
        '发送公开资料并感谢客户来访，等客户方便时继续讨论。',
        '不整理问题，直接重复发送宣传材料。',
        '未经许可转发现场方内部数据来促成项目。',
        [[1, 1], [1, 0], [0, -1], [-1, -2]],
      )),
    ],
    company_visit: [
      question('company-preparation', hypothetical('客户准备到访但尚未说明重点，你会怎样安排？'), options(
        '先问清到访目标、人员和时间，再安排相关同事与合适的参观范围。',
        '提供可选时段和简要流程，让客户补充希望了解的内容。',
        '只按内部方便安排，暂不询问客户目标。',
        '承诺开放不适合参观的办公区域或内部资料。',
        [[1, 1], [1, 0], [0, -1], [-1, -2]],
      )),
      question('company-visit', hypothetical('到访中客户提出涉及未公开信息的问题，你会怎样回应？'), options(
        '说明可分享范围，转向公开信息，并记录需要内部核实的问题。',
        '请相应同事确认哪些内容可以介绍后再答复。',
        '含糊带过，假装已经回答。',
        '为取信客户，直接展示未获授权的内部信息。',
        [[1, 1], [1, 0], [0, -1], [-1, -2]],
      )),
      question('company-follow-up', hypothetical('到访结束后，客户还在比较不同方案，你会怎样跟进？'), options(
        '发送客户关心的公开资料和待确认事项，并询问是否需要补充说明。',
        '简短致谢，说明后续可按客户节奏保持沟通。',
        '连续发送大量介绍材料，要求客户尽快表态。',
        '把礼貌性交流误写成客户已经决定合作。',
        [[1, 1], [1, 0], [0, -1], [-1, -2]],
      )),
    ],
    hospitality: [
      question('hospitality-preparation', hypothetical('你准备邀请一位客户吃饭或喝酒，怎样确认安排合适？'), options(
        '先确认客户是否方便、饮食偏好和合规边界，明确可选无酒精安排且不施压。',
        '提出时间和普通餐饮选项，说明客户不方便也可以改为工作沟通。',
        '直接订昂贵场所和酒水，再通知客户参加。',
        '把接受宴请或饮酒与项目照顾、合作条件挂钩。',
        [[1, 1], [1, 0], [-1, -1], [-2, -2]],
      )),
      question('hospitality-event', hypothetical('用餐时客户表示不饮酒且不想谈工作，你会怎样应对？'), options(
        '尊重选择，提供无酒精饮品，把交流保持轻松并按客户意愿结束。',
        '不劝酒，询问客户更自在的交流方式。',
        '反复劝酒或不断把话题拉回项目。',
        '用人情或项目机会暗示客户应当接受安排。',
        [[0, 2], [0, 1], [-1, -1], [-2, -2]],
      )),
      question('hospitality-follow-up', hypothetical('饭后客户只表示感谢，没有谈合作决定，你会怎样跟进？'), options(
        '礼貌致谢，不把用餐当作承诺；另行询问是否需要正常的业务资料。',
        '简短感谢并等待客户按自己的节奏提出后续需要。',
        '立刻追问项目进展，把饭局当成推动表态的理由。',
        '声称客户已因这次招待同意合作或给予便利。',
        [[1, 1], [0, 1], [-1, -1], [-2, -2]],
      )),
    ],
  },
  hospitalityNonAlcoholQuestion: question(
    'hospitality-event-respect-plan',
    hypothetical('你的方案已提前安排无酒精选项。现场客户表示时间不多、也不想谈项目，你会怎样回应？'),
    options(
      '尊重客户时间，不谈项目；轻松用餐并在合适时结束，另约客户方便时再聊业务。',
      '尊重客户意愿，把话题留给客户选择，按时结束安排。',
      '延长用餐并反复把话题引回项目。',
      '暗示客户既然接受邀请就应当给出项目承诺。',
      [[0, 2], [0, 1], [-1, -1], [-2, -2]],
    ),
  ),
  aiInstructions: `按客户对话、客户上下文、已约定活动类型和玩家提交的方案，判断方案对目标客户长期项目支持、沟通体验及玩家既有五个销售能力维度的影响。只依据方案中实际写出的安排和已知客户背景，不推测尚未写出的准备，不把提交动作或字数作为改善依据。

项目支持：看目标是否贴合该客户职责与真实需求，安排是否可执行，技术或案例依据是否可信，以及是否说明待确认事项、责任人与下一步。具体可信的安排可以正向；泛泛安排或只有热情用语不应加分；虚假承诺、忽略核心需求或越权可负向。

沟通体验：看方案是否尊重客户时间、偏好、表达边界和选择，是否便于参与并照顾交流节奏。尊重客户但暂未推动业务时，沟通体验可以正向而支持不变；安排明确但体验不当时，两项可以方向不同。

销售能力维度：只对方案实际体现的决策分析、关系建立、价值呈现、异议处理和信息发现表现给出变化；没有体现的维度保持不变。好方案、普通方案和不当方案应有不同结果，不要机械地全维度同涨同跌。

客户餐叙或饮酒邀约：关注是否结合客户沟通目标和偏好选择合适场合、控制节奏、尊重客户不饮酒或拒绝的选择，并安排自然的后续跟进；不得把宴请写成采购承诺。`,
  limits: {
    supportMin: -5,
    supportMax: 4,
    pleasureMin: -8,
    pleasureMax: 6,
    dimensionMin: -3,
    dimensionMax: 3,
  },
  weights: { plan: 1, quiz: 1 },
});

/** Parses into a new object each time so callers cannot mutate the shared defaults or their saved snapshot. */
export function resolveActivityExecutionConfig(input?: unknown): ActivityExecutionConfig {
  return activityExecutionConfigSchema.parse(input === undefined ? DEFAULT_ACTIVITY_EXECUTION_CONFIG : input);
}
