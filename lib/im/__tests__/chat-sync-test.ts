import { createChatSync, mergeMessages, type ChatSyncOptions } from '../chat-sync';
import type { ImMessage } from '../../api/endpoints/im';

const flush = () => new Promise<void>(resolve => { setTimeout(resolve, 0); });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function message(id: string, content = `m${id}`): ImMessage {
  return { id, senderId: '2', content };
}

function harness(overrides: Partial<ChatSyncOptions> = {}) {
  const state = { messages: [] as ImMessage[], sending: false };
  const options: ChatSyncOptions = {
    isSupport: false,
    conversationId: () => '7',
    token: () => 'token-a',
    isActive: () => true,
    read: async () => [],
    send: async () => message('99'),
    markRead: jest.fn(async () => undefined),
    subscribe: () => () => undefined,
    setMessages: updater => { state.messages = updater(state.messages); },
    setSending: sending => { state.sending = sending; },
    onError: () => undefined,
    ...overrides,
  };
  return { sync: createChatSync(options), options, state };
}

describe('chat-sync', () => {
  it('merges and sorts large decimal IDs without losing precision', () => {
    const merged = mergeMessages(
      [message('9007199254740993'), message('10'), message('9007199254740993', 'newer')],
      [message('9007199254740994'), message('10')],
    );
    expect(merged.map(item => item.id)).toEqual(['10', '9007199254740993', '9007199254740994']);
    expect(merged[1].content).toBe('newer');
  });

  it('sends without advancing the read cursor, so peer messages are still fetched', async () => {
    const reads: (string | undefined)[] = [];
    const { sync, options, state } = harness({
      read: async (_conv, afterId) => {
        reads.push(afterId);
        return afterId ? [message('6')] : [message('5')];
      },
      send: async () => message('99', 'mine'),
    });
    sync.setIdentity('token-a', '7');
    sync.activate();
    await flush();
    expect(state.messages.map(item => item.id)).toEqual(['5']);

    await expect(sync.send('mine')).resolves.toBe(true);
    expect(state.messages.map(item => item.id)).toEqual(['5', '99']);

    sync.refresh();
    await flush();
    expect(reads.at(-1)).toBe('5');
    expect(state.messages.map(item => item.id)).toEqual(['5', '6', '99']);
    expect(options.markRead).toHaveBeenCalledTimes(2);
  });

  it('coalesces refresh requests into one in-flight read', async () => {
    const first = deferred<ImMessage[]>();
    const read = jest.fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([]);
    const { sync } = harness({ read });
    sync.setIdentity('token-a', '7');
    sync.activate();
    sync.refresh();
    sync.refresh();
    expect(read).toHaveBeenCalledTimes(1);
    first.resolve([message('1')]);
    await flush();
    expect(read).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenLastCalledWith('7', '1');
  });

  it('drains full pages and keeps the cursor monotonic', async () => {
    const page = Array.from({ length: 100 }, (_, index) => message(String(index + 1)));
    const read = jest.fn()
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([message('101')]);
    const { sync, state } = harness({ read });
    sync.setIdentity('token-a', '7');
    sync.activate();
    await flush();
    expect(state.messages).toHaveLength(101);
    expect(read).toHaveBeenLastCalledWith('7', '100');
  });

  it('ignores reads that finish after the identity or screen changed', async () => {
    let token = 'token-a';
    const stale = deferred<ImMessage[]>();
    const read = jest.fn()
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce([message('new')]);
    const { sync, state } = harness({ read, token: () => token });
    sync.setIdentity('token-a', '7');
    sync.activate();
    token = 'token-b';
    sync.setIdentity('token-b', '7');
    sync.activate();
    await flush();
    expect(state.messages.map(item => item.id)).toEqual(['new']);
    stale.resolve([message('stale')]);
    await flush();
    expect(state.messages.map(item => item.id)).toEqual(['new']);
  });

  it('does not read or mark read while the screen is inactive', async () => {
    const read = jest.fn().mockResolvedValue([]);
    const markRead = jest.fn().mockResolvedValue(undefined);
    const { sync } = harness({ read, markRead, isActive: () => false });
    sync.setIdentity('token-a', '7');
    sync.activate();
    sync.refresh();
    await flush();
    expect(read).not.toHaveBeenCalled();
    expect(markRead).not.toHaveBeenCalled();
  });

  it('surfaces send failures and restores the sending flag', async () => {
    const onError = jest.fn();
    const { sync, state } = harness({
      send: async () => { throw new Error('network'); },
      onError,
    });
    sync.setIdentity('token-a', '7');
    sync.activate();
    await flush();
    await expect(sync.send('hello')).resolves.toBe(false);
    expect(onError).toHaveBeenCalledWith('network');
    expect(state.sending).toBe(false);
  });

  it('clears the sending flag when the screen leaves mid-send without appending the reply', async () => {
    const pending = deferred<ImMessage>();
    const { sync, state } = harness({ send: () => pending.promise });
    sync.setIdentity('token-a', '7');
    sync.activate();
    await flush();
    const request = sync.send('hello');
    expect(state.sending).toBe(true);
    sync.deactivate();
    pending.resolve(message('9'));
    await expect(request).resolves.toBe(false);
    expect(state.sending).toBe(false);
    expect(state.messages).toEqual([]);
  });
});
