#!/usr/bin/env node
const { spawnSync } = require('child_process');

const reactNative = process.platform === 'win32' ? 'react-native.cmd' : 'react-native';
const result = spawnSync(
  reactNative,
  ['bundle-harmony', '--dev', 'false', '--entry-file', 'index.harmony.js'],
  {
    stdio: 'inherit',
    env: { ...process.env, RN_BUNDLE_PLATFORM: 'harmony' },
    // Windows 上 react-native.cmd 必须经 shell 启动，否则 Node 直接返回 EINVAL（命令未执行、无任何输出）。
    shell: process.platform === 'win32',
  },
);

if (result.error) {
  console.error('[harmony] react-native 启动失败：' + result.error.message);
}
if (result.error || result.status !== 0) {
  process.exit(result.status || 1);
}
