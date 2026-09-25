/**
 * 剪贴板能力。一期不引 `expo-clipboard`(需 expo-harmony-cli 安装并实机验证)。
 *
 * 实现顺序:浏览器 `navigator.clipboard` -> 旧版 `execCommand('copy')` -> 返回 unsupported。
 * 详情页"复制地址"与 ErrorBoundary"复制错误摘要"都走这里,拿不到结果时 MUST 展示
 * 可长按选中的原文,而不是静默无反应。
 */
import { type CapabilityResult, failed, ok, unsupported } from './result';

export interface ClipboardApi {
  readonly kind: string;
  isAvailable(): boolean;
  copy(text: string): Promise<CapabilityResult<{ length: number }>>;
}

interface NavigatorLike {
  clipboard?: { writeText?(text: string): Promise<void> };
}

function getNavigator(): NavigatorLike | null {
  const nav = (globalThis as { navigator?: unknown }).navigator;
  return nav ? (nav as NavigatorLike) : null;
}

function getDocument(): { execCommand?(cmd: string): boolean } | null {
  const doc = (globalThis as { document?: unknown }).document;
  return doc ? (doc as unknown as { execCommand?(cmd: string): boolean }) : null;
}

class WebClipboard implements ClipboardApi {
  readonly kind = 'clipboard:web';

  isAvailable(): boolean {
    return Boolean(getNavigator()?.clipboard?.writeText || getDocument());
  }

  async copy(text: string): Promise<CapabilityResult<{ length: number }>> {
    const nav = getNavigator();
    if (nav?.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(text);
        return ok<{ length: number }>({ length: text.length }, this.kind);
      } catch (error) {
        return failed<{ length: number }>(
          '复制失败,请长按选中文字手动复制。',
          this.kind,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    const doc = getDocument();
    if (doc?.execCommand) {
      try {
        return doc.execCommand('copy')
          ? ok<{ length: number }>({ length: text.length }, this.kind)
          : failed<{ length: number }>('复制失败,请长按选中文字手动复制。', this.kind);
      } catch (error) {
        return failed<{ length: number }>(
          '复制失败,请长按选中文字手动复制。',
          this.kind,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    return unsupported<{ length: number }>('当前环境没有剪贴板能力。', this.kind);
  }
}

class NativePlaceholderClipboard implements ClipboardApi {
  readonly kind = 'clipboard:native-unavailable';

  isAvailable(): boolean {
    return false;
  }

  copy(): Promise<CapabilityResult<{ length: number }>> {
    return Promise.resolve(
      unsupported<{ length: number }>(
        '当前版本未接入系统剪贴板,请长按选中文字手动复制。',
        this.kind,
        '需要执行 pnpm dlx expo-harmony-cli install expo-clipboard 后替换本实现。',
      ),
    );
  }
}

const hasWebClipboard =
  Boolean(getNavigator()?.clipboard?.writeText) || Boolean(getDocument());

export const clipboard: ClipboardApi = hasWebClipboard
  ? new WebClipboard()
  : new NativePlaceholderClipboard();
