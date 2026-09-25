/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: [
    '**/__tests__/**/*-test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  // shadcn-for-RN 原语(@rn-primitives)与 RNOH 伴生包都直接发布 ESM/未转译源码,
  // 必须让 babel-jest 处理它们,否则 `import` 语法在 node 环境直接报错。
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@rn-primitives/.*|@react-native-oh/.*|@react-native-ohos/.*|nativewind|react-native-css-interop|lucide-react-native))',
  ],
  collectCoverageFrom: [
    '{lib,store,hooks,features,components,app}/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
  ],
  clearMocks: true,
  fakeTimers: { enableGlobally: false },
};
