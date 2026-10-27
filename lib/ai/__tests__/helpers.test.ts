/**
 * lib/ai/helpers.ts 纯函数单测:气泡行组装、标题截断、预设契约。
 */
import type { AiMessage } from '../../api/endpoints/ai';
import { AI_PRESETS, buildBubbleRows, conversationTitle, pendingBubbleKey } from '../helpers';

function message(id: string, role: AiMessage['role'], content: string): AiMessage {
  return { id, role, content, createTime: '2026-10-28 12:00:00' };
}

describe('buildBubbleRows', () => {
  it('一消息一气泡,key 加前缀,保留角色与时间', () => {
    const rows = buildBubbleRows([
      message('1', 'user', '你好'),
      message('2', 'assistant', '你好呀!'),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ key: 'm:1', role: 'user', content: '你好' });
    expect(rows[1].time).toBe('2026-10-28 12:00:00');
  });
});

describe('conversationTitle', () => {
  it('空标题回落"新对话",超长截断加省略号', () => {
    expect(conversationTitle(null)).toBe('新对话');
    expect(conversationTitle('  ')).toBe('新对话');
    expect(conversationTitle('短标题')).toBe('短标题');
    const long = '一'.repeat(25);
    const result = conversationTitle(long);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBe(21);
  });
});

describe('pendingBubbleKey / AI_PRESETS', () => {
  it('发送中气泡 key 固定,预设都带提示词前缀', () => {
    expect(pendingBubbleKey()).toBe('pending:outgoing');
    for (const preset of AI_PRESETS) {
      expect(preset.prompt.length).toBeGreaterThan(0);
    }
  });
});
