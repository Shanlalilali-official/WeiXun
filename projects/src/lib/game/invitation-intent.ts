/**
 * Detect an explicit request to arrange an in-person visit inside an ordinary
 * phone, email or WeChat message. Historical references such as "上次见面"
 * and "见面后发材料" must remain ordinary conversation.
 */
export function isNaturalLanguageInvitation(text: string): boolean {
  const normalized = text.replace(/\s+/g, '').trim();
  if (!normalized || /(?:见面|拜访|会面|碰面)后/.test(normalized)) return false;
  if (/(?:上次|此前|之前|刚才|已经|已完成).{0,8}(?:见面|拜访|会面|碰面)/.test(normalized)) return false;

  if (/\b(?:meet|meeting|visit)\b/i.test(text)) return true;

  return [
    /(?:邀约|邀请)(?!结果|已发送|已接受|被拒绝)/,
    /(?:希望|想(?:要)?|能否|是否可以|可否|方便|安排|约|申请|邀请|带您|请您).{0,24}(?:见面|拜访|会面|碰面|当面(?:沟通|交流|聊))/,
    /(?:安排|希望|想|能否|是否可以|可否|方便|邀请|带您|请您).{0,24}(?:正式沟通|现场沟通|技术交流|技术研讨|会议|案例.{0,8}(?:现场)?(?:参观|考察)|参观.{0,8}(?:案例|项目|公司|贵司|贵公司|我司|我们公司))/,
    /(?:见面|拜访|会面|碰面|当面(?:沟通|交流|聊)).{0,12}(?:吗|么|时间|安排|沟通|交流|聊)/,
  ].some((pattern) => pattern.test(normalized));
}

/**
 * An activity invitation is ordinary customer dialogue until both sides
 * agree. Keep it out of the legacy appointment shortcut so it can be matched
 * only after the real customer reply is stored.
 */
export function isNaturalLanguageCustomerActivityInvitation(text: string): boolean {
  const normalized = text.replace(/\s+/g, '').trim();
  if (!normalized) return false;

  const activityPattern = /技术(?:交流|研讨)(?:会|活动)?|(?:案例|项目).{0,8}(?:现场)?(?:参观|考察)|(?:参观|考察).{0,8}(?:案例|项目)(?:现场)?|公司参观|参观(?:贵司|贵公司|我司|我们公司|咱们公司)|(?:贵司|贵公司|我们公司|我司)参观/u;
  if (!activityPattern.test(normalized)) return false;

  const questionNormalized = normalized.replace(/(?:要不要|能不能|可不可以|可否|能否|是否)/gu, '');
  const cancellationOrDeclinePattern = /(?:取消|撤销|作废|不再安排|不需要安排|不想安排|不愿意安排|不安排|不要安排|暂不安排|暂缓|先不办|先不组织|先不举办|不参加|不去了|不考虑|不方便|不能安排|不接受|拒绝|否决)/u;
  const ambiguousQuestion = /(?:方便不方便|方不方便|不方便.{0,8}(?:安排|组织|举办|召开|开|办).{0,12}(?:吗|么|呢)|不是.{0,4}(?:不能|不方便|不可以)|并非.{0,4}(?:不能|不方便|不可以)|(?:时间|日期|人员|名单).{0,8}(?:不能定|定不了|未确定|没确定).{0,20}(?:但|不过|同时).{0,16}(?:可以|能|先).{0,8}(?:交流|参观|讨论))/u.test(normalized)
    || /(?:吗|么|呢|？|\?)$/u.test(normalized);
  if (!ambiguousQuestion && cancellationOrDeclinePattern.test(questionNormalized)
    && (activityPattern.test(questionNormalized) || activityPattern.test(normalized))) return false;

  const caseAvailabilityQuestion = /(?:有没有|是否有|有无|是否存在).{0,20}(?:类似|相似|同类)?(?:案例|项目|技术交流会|技术研讨会)|(?:有没有|是否有|有无).{0,16}(?:技术交流会|技术研讨会)/u.test(normalized);
  if (caseAvailabilityQuestion) return false;

  const proposalIntent = /(?:安排|组织|举办|召开|开|办|举行|开展|策划|邀请|带您|带你)(?!过|了)[^。！？；]{0,32}(?:技术(?:交流|研讨)(?:会|活动)?|(?:案例|项目).{0,8}(?:现场)?(?:参观|考察)|公司参观)|(?:技术(?:交流|研讨)(?:会|活动)?|(?:案例|项目).{0,8}(?:现场)?(?:参观|考察)|公司参观)[^。！？；]{0,32}(?:安排|组织|举办|召开|开|办|举行|开展|邀请|能不能|可不可以|要不要|怎么样|行不行)(?!过|了)/u.test(questionNormalized);

  const historicalMention = /(?:上次|此前|之前|刚才|已经|已完成|曾经|过去|以前).{0,16}(?:技术(?:交流|研讨)|(?:案例|项目).{0,8}(?:现场)?(?:参观|考察)|公司参观)|(?:技术(?:交流|研讨)|(?:案例|项目).{0,8}(?:现场)?(?:参观|考察)|公司参观).{0,16}(?:上次|此前|之前|已完成|曾经|过去|以前)/u.test(normalized);
  if (historicalMention && !proposalIntent) return false;

  return isNaturalLanguageInvitation(text) || proposalIntent;
}

/**
 * Marks activity-related dialogue that needs the activity reply rules. This is
 * intentionally broader than proposal detection: the model must distinguish a
 * new proposal from a player's explicit withdrawal or a contextual mention.
 */
export function isCustomerActivityReplyContext(
  text: string,
  recentConversation: readonly { speaker: 'sales' | 'customer'; text: string }[] = [],
): boolean {
  const normalized = text.replace(/\s+/g, '').trim();
  if (!normalized) return false;
  const activityPattern = /技术(?:交流|研讨)(?:会|活动)?|(?:案例|项目).{0,8}(?:现场)?(?:参观|考察)|公司参观|参观(?:贵司|贵公司|我司|我们公司|咱们公司)/u;
  if (activityPattern.test(normalized)) {
    if (/(?:比如|例如|举例|引用|原话|原句|客户说|对方说).{0,24}[“「『《]/u.test(normalized)) return false;
    const actionPattern = /(?:安排|组织|举办|召开|开|办|举行|开展|策划|邀请|带您|带你|要不要|能不能|可不可以|能否|可否|方便不方便|方不方便|是不是不能|不是不能|撤回|撤销|取消|不再|先不办|不安排|暂缓|讨论|商量|时间|日期|哪天|几点|什么时候|时间定不了|定不了|未确定|没确定|吗|么|呢|？|\?)/u;
    if (!actionPattern.test(normalized)) return false;
    const historicalMention = /(?:上次|此前|之前|已经|曾经|过去|以前).{0,16}(?:技术(?:交流|研讨)|(?:案例|项目).{0,8}(?:参观|考察)|公司参观)|(?:技术(?:交流|研讨)|(?:案例|项目).{0,8}(?:参观|考察)|公司参观).{0,16}(?:上次|此前|之前|已完成|曾经|过去|以前)/u.test(normalized);
    return !historicalMention || /(?:刚才|前面|那个|该项).{0,10}(?:提议|活动|安排|想法)|撤回|取消|先不办/u.test(normalized);
  }

  // A terse date/time follow-up can still be about an activity proposal from
  // an earlier turn (for example, "那就下周三？"). Keep the legacy
  // appointment shortcut from consuming it before the activity guard sees
  // the surrounding conversation.
  const recent = recentConversation.slice(-8);
  let lastOpenProposalIndex = -1;
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const item = recent[index];
    if (item.speaker !== 'sales') continue;
    if (isCustomerActivityReplyContext(item.text)) {
      lastOpenProposalIndex = index;
      break;
    }
  }
  if (lastOpenProposalIndex < 0) return false;

  const laterSalesMessages = recent.slice(lastOpenProposalIndex + 1).filter((item) => item.speaker === 'sales');
  if (laterSalesMessages.some((item) => /(?:撤回|取消|先不办|暂缓|不再安排|不考虑)/u.test(item.text))) return true;
  if (laterSalesMessages.some((item) => !activityPattern.test(item.text)
    && !/(?:下周|本周|这周|周[一二三四五六日天]|星期|几号|哪天|几点|什么时候|时间|日期|那就|那么|具体安排|约在|定在)/u.test(item.text))) return false;

  return /(?:下周|本周|这周|周[一二三四五六日天]|星期|几号|哪天|几点|什么时候|时间|日期|那就.{0,12}(?:天|周|月|号|点)|那么.{0,12}(?:天|周|月|号|点)|具体安排|约在|定在|参观|交流会)/u.test(normalized);
}
