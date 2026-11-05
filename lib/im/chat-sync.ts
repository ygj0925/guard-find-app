import type { ImMessage } from '../api/endpoints/im';

/** Compare decimal message IDs without converting them to JS numbers. */
export function compareMessageIds(a: string | number, b: string | number): number {
  const x = String(a).replace(/^0+(?=\d)/, '');
  const y = String(b).replace(/^0+(?=\d)/, '');
  return x.length - y.length || (x < y ? -1 : x > y ? 1 : 0);
}

export function mergeMessages(old: ImMessage[], incoming: ImMessage[]): ImMessage[] {
  return [...new Map([...old, ...incoming].map(item => [String(item.id), item])).values()]
    .sort((a, b) => compareMessageIds(a.id, b.id));
}

export interface ChatSyncOptions {
  isSupport: boolean;
  conversationId: () => string;
  token: () => string;
  isActive: () => boolean;
  read: (conversationId: string, afterId?: string) => Promise<ImMessage[]>;
  send: (conversationId: string, content: string) => Promise<ImMessage>;
  markRead: (conversationId: string) => Promise<void>;
  subscribe: (conversationId: string, refresh: () => void) => () => void;
  setMessages: (updater: (previous: ImMessage[]) => ImMessage[]) => void;
  setSending: (sending: boolean) => void;
  onError: (message: string) => void;
}

/**
 * Chat synchronization for one mounted screen.
 * Reads are single-flight per active generation; sending never advances the read cursor.
 */
export function createChatSync(options: ChatSyncOptions) {
  let generation = 0;
  let running = false;
  let identity = '';
  let conversation = '';
  let lastId: string | undefined;
  let flightGeneration: number | null = null;
  let queued = false;
  let unsubscribe: (() => void) | undefined;

  function validFor(gen: number, token: string, convId: string) {
    return running && gen === generation && options.isActive()
      && options.token() === token && options.conversationId() === convId;
  }

  function deactivate() {
    generation++;
    running = false;
    flightGeneration = null;
    queued = false;
    unsubscribe?.();
    unsubscribe = undefined;
  }

  async function drain(gen: number, token: string, convId: string) {
    flightGeneration = gen;
    try {
      do {
        if (!validFor(gen, token, convId))
          return;
        queued = false;
        const before = lastId;
        const incoming = await options.read(convId, before);
        if (!validFor(gen, token, convId))
          return;
        if (incoming.length) {
          options.setMessages(previous => mergeMessages(previous, incoming));
          let next = lastId;
          for (const message of incoming) {
            if (next === undefined || compareMessageIds(message.id, next) > 0)
              next = String(message.id);
          }
          if (next !== before && !options.isSupport) {
            lastId = next;
            try {
              await options.markRead(convId);
            }
            catch {
              // The next read can still retry marking; never block message display.
            }
          }
          else {
            lastId = next;
          }
          // A full page may have more; a fully duplicate page must not spin.
          if (incoming.length >= 100 && next !== before)
            queued = true;
        }
      } while (queued && validFor(gen, token, convId));
    }
    catch {
      // Keep the cursor and let the visible-screen poll retry.
    }
    finally {
      if (flightGeneration === gen)
        flightGeneration = null;
    }
  }

  function refresh() {
    if (!running || !conversation || !options.isActive())
      return;
    const gen = generation;
    if (flightGeneration === gen) {
      queued = true;
      return;
    }
    void drain(gen, identity, conversation);
  }

  return {
    /** Clear state only when the authenticated identity or conversation really changed. */
    setIdentity(token: string, convId: string) {
      if (token === identity && convId === conversation)
        return;
      deactivate();
      identity = token;
      conversation = convId;
      lastId = undefined;
      options.setMessages(() => []);
    },
    /** Start reading for the visible, authenticated screen. */
    activate() {
      if (!identity || !conversation || !options.isActive())
        return;
      deactivate();
      running = true;
      const gen = generation;
      unsubscribe = options.subscribe(conversation, () => refresh());
      if (validFor(gen, identity, conversation))
        void drain(gen, identity, conversation);
    },
    deactivate,
    reset() {
      deactivate();
      identity = '';
      conversation = '';
      lastId = undefined;
      options.setMessages(() => []);
      options.setSending(false);
    },
    refresh,
    async send(content: string): Promise<boolean> {
      const gen = generation;
      const token = identity;
      const convId = conversation;
      if (!running || !convId || !validFor(gen, token, convId))
        return false;
      options.setSending(true);
      try {
        const message = await options.send(convId, content);
        if (!validFor(gen, token, convId))
          return false;
        options.setMessages(previous => mergeMessages(previous, [message]));
        // Deliberately keep lastId: a send must not skip peer messages still unfetched.
        return true;
      }
      catch (cause) {
        if (validFor(gen, token, convId))
          options.onError(cause instanceof Error && cause.message ? cause.message : '发送失败,请稍后再试');
        return false;
      }
      finally {
        // 同一时刻只允许一次发送;即使页面已失焦/身份已切换,也要把发送态收回。
        options.setSending(false);
      }
    },
  };
}
