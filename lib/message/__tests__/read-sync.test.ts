import type { Message } from '@/lib/api/endpoints/message';
import { markAllMessagesRead, markMessageRead, messageTarget } from '../read-sync';

const mockMarkRead = jest.fn();
const mockMarkAllRead = jest.fn();
const mockBump = jest.fn();
const mockSetUnread = jest.fn();
const mockSyncUnread = jest.fn(async () => undefined);

jest.mock('@/lib/api/endpoints/message', () => ({
  messageApi: {
    markRead: (id: string) => mockMarkRead(id),
    markAllRead: () => mockMarkAllRead(),
  },
}));
jest.mock('@/store/session', () => ({
  syncUnreadCount: () => mockSyncUnread(),
  useSession: { getState: () => ({ bumpUnread: mockBump, setUnreadCount: mockSetUnread }) },
}));

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: 'm-1',
    type: 'CASE_LEAD',
    title: '收到 1 条新线索',
    content: '…',
    bizType: 'FIND_CASE',
    bizId: 'c-1',
    path: '/case/c-1/leads',
    readStatus: false,
    createTime: '2026-11-11 10:00:00',
    ...overrides,
  };
}

describe('消息已读同步(spec: 消息中心与未读角标)', () => {
  beforeEach(() => {
    mockMarkRead.mockReset().mockResolvedValue(undefined);
    mockMarkAllRead.mockReset().mockResolvedValue(undefined);
    mockBump.mockReset();
    mockSetUnread.mockReset();
    mockSyncUnread.mockClear();
  });

  it('未读消息:调接口后只改本条并把角标减 1', async () => {
    const patch = jest.fn();
    await markMessageRead(message(), patch);
    expect(mockMarkRead).toHaveBeenCalledWith('m-1');
    expect(patch).toHaveBeenCalledWith('m-1', { readStatus: true });
    expect(mockBump).toHaveBeenCalledWith(-1);
  });

  it('已读消息:不发请求、不动角标', async () => {
    const patch = jest.fn();
    await markMessageRead(message({ readStatus: true }), patch);
    expect(mockMarkRead).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    expect(mockBump).not.toHaveBeenCalled();
  });

  it('接口失败:不改本地状态,错误抛给页面', async () => {
    mockMarkRead.mockRejectedValueOnce(new Error('offline'));
    const patch = jest.fn();
    await expect(markMessageRead(message(), patch)).rejects.toThrow('offline');
    expect(patch).not.toHaveBeenCalled();
    expect(mockBump).not.toHaveBeenCalled();
  });

  it('全部已读:只补未读项、角标归零后再向服务端校准', async () => {
    const patch = jest.fn();
    await markAllMessagesRead([message({ id: 'a' }), message({ id: 'b', readStatus: true })], patch);
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith('a', { readStatus: true });
    expect(mockSetUnread).toHaveBeenCalledWith(0);
    expect(mockSyncUnread).toHaveBeenCalledTimes(1);
  });

  it('全部已读失败:角标保持原值', async () => {
    mockMarkAllRead.mockRejectedValueOnce(new Error('500'));
    await expect(markAllMessagesRead([message()], jest.fn())).rejects.toThrow('500');
    expect(mockSetUnread).not.toHaveBeenCalled();
  });

  it('跳转按服务端 path,缺省时按档案业务兜底,其他无目标', () => {
    expect(messageTarget(message())).toBe('/case/c-1/leads');
    expect(messageTarget(message({ path: null }))).toBe('/case/c-1');
    expect(messageTarget(message({ path: null, bizType: 'SYSTEM', bizId: null }))).toBeNull();
  });
});
