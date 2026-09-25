/**
 * Jest 全局初始化。
 *
 * 说明：本仓库的测试策略以"逻辑单元"为主（API 客户端解包与 401、游标分页去重、
 * 发布表单分步校验、能力分派的 unsupported 分支），渲染快照只覆盖少数关键页面，
 * 因此这里只放跨用例共享的最小环境补丁。
 */

// react-native 的 jsdom/web 环境下 Dimensions 可能未初始化，早期访问会抛错。
import { Dimensions } from 'react-native';

Dimensions.addEventListener?.('change', () => {
  // 测试内不需要响应尺寸变化，占位以防未处理的 rejection
});
