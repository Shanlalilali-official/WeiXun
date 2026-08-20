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
    /(?:希望|想(?:要)?|能否|是否可以|可否|方便|安排|约|申请).{0,12}(?:见面|拜访|会面|碰面|当面(?:沟通|交流|聊))/,
    /(?:安排|希望|想|能否|是否可以|可否).{0,12}(?:正式沟通|现场沟通|技术交流|会议)/,
    /(?:见面|拜访|会面|碰面|当面(?:沟通|交流|聊)).{0,12}(?:吗|么|时间|安排|沟通|交流|聊)/,
  ].some((pattern) => pattern.test(normalized));
}
