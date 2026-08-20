import assert from 'node:assert/strict';
import { isNaturalLanguageInvitation } from '../src/lib/game/invitation-intent';

const positiveExamples = [
  '您好，希望围绕一线流程安排一次正式沟通，方便和您见面吗？',
  '这周能否约个时间到贵司当面交流？',
  '我们想和您安排一次技术交流。',
  'Could we schedule a meeting next week?',
];
const negativeExamples = [
  '上次见面后您提到的材料我已经发到邮箱了。',
  '见面后我们再发材料，先把现有数据核对一下。',
  '之前拜访的纪要已经整理完成。',
  '谢谢您回复，我继续补充项目资料。',
];

for (const example of positiveExamples) assert.equal(isNaturalLanguageInvitation(example), true, example);
for (const example of negativeExamples) assert.equal(isNaturalLanguageInvitation(example), false, example);

console.log('invitation intent tests passed');
