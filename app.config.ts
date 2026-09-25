import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * 动态配置层:把 .env / CI 注入的 EXPO_PUBLIC_* 值同时写进 `expo.extra`。
 *
 * 为什么两处都写:`EXPO_PUBLIC_*` 只有在打包时被内联进 JS,改一次值要重打 bundle;
 * 走 `extra` 则能被 `Constants.expoConfig.extra` 读到,且 `lib/env` 的优先级是
 * extra > EXPO_PUBLIC_*,便于真机调试时热改。
 *
 * 真实地址不入库:仓库只保留 .env.example(见 spec: 集中式环境配置)。
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const extra = {
    ...(config.extra ?? {}),
    ENV_NAME: process.env.EXPO_PUBLIC_ENV_NAME ?? process.env.NODE_ENV ?? 'development',
    API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
    WS_BASE_URL: process.env.EXPO_PUBLIC_WS_BASE_URL ?? '',
    AGREEMENT_VERSION: process.env.EXPO_PUBLIC_AGREEMENT_VERSION ?? 'v1',
  };

  return {
    ...config,
    extra,
  } as ExpoConfig;
};
