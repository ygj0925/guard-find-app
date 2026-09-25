// ESLint 平铺配置(flat config)。除 Expo 基线外,本文件承载三条项目硬约束:
//   1) 业务代码禁止 Platform.OS / Platform.select 分支(平台差异走 lib/capabilities + .harmony.ts 分派)
//   2) 禁止 import expo-asset / expo-image(鸿蒙侧 expo-asset 被 shim 成 no-op,远程图会静默不显示)
//   3) 禁止裸 fetch(必须经 lib/api/client.ts 才能拿到 token 注入 + {code,msg,data} 解包 + 401 处理)
const expoConfig = require('eslint-config-expo/flat');

/** 允许出现平台分支与原生分派的目录。 */
const CAPABILITY_FILES = [
  'lib/capabilities/**',
  'lib/storage/**',
  'components/ui/**',
];

/** 业务代码范围:除能力层之外的全部源码。 */
const BUSINESS_FILES = [
  'app/**/*.ts',
  'app/**/*.tsx',
  'features/**/*.ts',
  'features/**/*.tsx',
  'hooks/**/*.ts',
  'hooks/**/*.tsx',
  'providers/**/*.ts',
  'providers/**/*.tsx',
  'store/**/*.ts',
  'components/**/*.ts',
  'components/**/*.tsx',
  'lib/**/*.ts',
];

const noPlatformBranch = {
  selector:
    "MemberExpression[object.name='Platform'] > Identifier.property[name='OS']",
  message:
    '业务代码禁止 Platform.OS 分支。平台差异请放进 lib/capabilities/*.harmony.ts(x),由 Metro 按 RN_BUNDLE_PLATFORM 分派。',
};

const noPlatformSelect = {
  selector:
    "CallExpression[callee.object.name='Platform'][callee.property.name='select']",
  message:
    '业务代码禁止 Platform.select。平台差异请放进 lib/capabilities/*.harmony.ts(x)。',
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      '.expo-harmony/**',
      'dist/**',
      'web-build/**',
      'coverage/**',
      'harmony/**',
      'patches/**',
      'shims/**',
      'scripts/**',
      'index.harmony.js',
      'metro.config.js',
      'babel.config.js',
      'tailwind.config.js',
      'jest.config.js',
      '*.config.cjs',
    ],
  },
  ...expoConfig,
  {
    files: BUSINESS_FILES,
    ignores: [...CAPABILITY_FILES, '**/*.harmony.ts', '**/*.harmony.tsx'],
    rules: {
      'no-restricted-syntax': ['error', noPlatformBranch, noPlatformSelect],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-asset',
              message:
                '禁止使用 expo-asset:鸿蒙侧它被 shims/.alias-map.json 换成 no-op,远程图片会静默不显示。请改用 react-native 的 Image + uri。',
            },
            {
              name: 'expo-image',
              message:
                '禁止使用 expo-image:一期未通过 expo-harmony-cli 引入并实机验证。请改用 react-native 的 Image + uri。',
            },
            {
              name: 'expo-secure-store',
              message:
                '禁止使用 expo-secure-store:RNOH 无已验证适配。token 读写走 lib/storage/token。',
            },
            {
              name: 'expo-location',
              message: '一期不使用定位(无已验证鸿蒙适配):就近检索用城市手选实现。',
            },
            {
              name: 'expo-camera',
              message: '一期不使用相机(无已验证鸿蒙适配)。',
            },
            {
              name: 'expo-notifications',
              message:
                '一期不使用系统推送(无已验证鸿蒙适配):通知走站内信 + WebSocket + 轮询降级。',
            },
            {
              name: 'expo-file-system',
              message: '一期不使用 expo-file-system(无已验证鸿蒙适配)。',
            },
            {
              name: 'expo-splash-screen',
              message: '一期不使用 expo-splash-screen(无已验证鸿蒙适配)。',
            },
            {
              name: 'expo-blur',
              message: '一期不使用 expo-blur(无已验证鸿蒙适配)。',
            },
          ],
        },
      ],
      // 本地规则:裸 fetch 只允许出现在 lib/api/client.ts 与 lib/monitor.ts 之外都被禁。
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            '禁止裸调 fetch:必须经 lib/api/client.ts 的 request(),否则没有 token 注入、{code,msg,data} 解包、超时中断与 401 处理。',
        },
      ],
    },
  },
  {
    // 上传需要 FormData + fetch,能力层需要触碰原生模块存在性,单独放开。
    // 注意：components/ui/** 属于"允许平台分支"的能力区（shadcn 原语本就需要按平台选型），
    // 因此这里不再对它施加 noPlatformBranch/noPlatformSelect —— 上一个块已通过
    // ignores: [...CAPABILITY_FILES] 把它排除，本块若再展开 CAPABILITY_FILES 就会自相矛盾。
    files: [...CAPABILITY_FILES.filter((pattern) => !pattern.startsWith('components/ui')), 'lib/api/client.ts'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-asset',
              message:
                '禁止使用 expo-asset:鸿蒙侧它被 shim 成 no-op,远程图片会静默不显示。',
            },
          ],
        },
      ],
      'no-restricted-syntax': ['error', noPlatformBranch, noPlatformSelect],
    },
  },
];
