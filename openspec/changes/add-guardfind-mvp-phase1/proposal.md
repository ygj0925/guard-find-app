## Why

`guard-find-app` 目前只有 245 行 Expo 官方模板页(`app/(tabs)/index.tsx` 还在讲"Step 1: Try it"),`lib/` 只有一个 `cn()`、`hooks/` 全是模板、`constants/Colors.ts` 还是 Expo 蓝,零 API 客户端、零 token 存储、零状态管理、零业务页面。而规划书一期的闭环(注册 → 发布寻人档案 → 广场扩散 → 提交线索 → 收通知 → 确认找回)需要 App 侧把 `guard-find-server` 新增的 `/app/**` 接口全部接上,并且必须同时跑在 iOS、Android、HarmonyOS 上。

产品与模块设计见工作区 `doc/天下无拐App整体功能规划书.md`;后端契约见 `guard-find-server/openspec/changes/add-guardfind-mvp-phase1/specs/**`。

## What Changes

- 建立 **客户端基础设施**:集中式环境配置(禁止硬编码 host)、`fetch` 封装与统一响应解包、token 存储与自动携带、状态管理、全局 ErrorBoundary(鸿蒙无 JS 红框,必须有)、`typecheck` / CI 安全 `test` / eslint 配置 / `tailwindcss-animate` 等质量基线。
- 建立 **路由骨架**:替换模板页,`auth` 组 + `(tabs)` 五 Tab(广场 / 发布 / 社区占位 / 消息 / 我的)+ 档案详情 + 线索 + 资料编辑。
- 新增 **登录与会话**:手机号验证码为主、密码为辅,验证码倒计时与错误分级,自动建档后引导完善资料,启动静默恢复会话。
- 新增 **广场浏览**:四流切换、城市手选、筛选器、搜索、下拉刷新与游标翻页、卡片与详情脱敏展示、紧急档倒计时视觉。
- 新增 **发布流程**:5 步分步表单 + 合规告知勾选 + 草稿本地暂存与云端同步 + 图片选取与客户端压缩。
- 新增 **线索与消息**:线索提交表单(防骗常驻提示)、家属侧线索列表与处置、消息中心与未读角标、WebSocket 断线降级轮询。
- 新增 **鸿蒙兼容层**:能力探测 + `.harmony.tsx` / `.harmony.ts` 平台分派,存储、图片加载、图片选择三处按鸿蒙现状降级;**不引入未在 RNOH 验证过的原生依赖**。
- **BREAKING**:模板自带页与 `assets/images/react-logo*`、`ThemedText/ThemedView/ParallaxScrollView/Collapsible/HelloWave/ExternalLink/HapticTab` 等模板组件被业务实现取代或删除;`scripts/reset-project.js` 移除。

## Capabilities

### New Capabilities

- `app-client-infrastructure`:环境配置、API 客户端与拦截、token 存储、状态管理、错误边界、UI 原语补齐、质量脚本。
- `app-account-session`:登录注册、会话恢复、资料完善、账号安全与注销。
- `app-plaza-browsing`:广场四流、筛选与搜索、档案详情、收藏与分享。
- `app-case-publishing`:分步发布、草稿、我的档案与续期/找回/撤回/删除。
- `app-lead-and-messages`:线索提交与家属侧处置、消息中心与角标、通知偏好。
- `app-harmony-compatibility`:三端差异分派与降级规则、原生依赖引入流程约束。

### Modified Capabilities

无(`openspec/specs/` 为空,本仓库首次建立规格)。

## Impact

- **代码**:新增 `app/**` 业务路由;新增 `lib/{api,storage,env,auth,format}`、`store/`、`features/`、`providers/`;`app/_layout.tsx` 重写(需补 `GestureHandlerRootView` + `SafeAreaProvider` + ErrorBoundary,并清掉被 CLI 改坏的空 `useEffect`);`tailwind.config.js` 与 `global.css` 换成品牌 token。
- **依赖**:仅通过 `pnpm dlx expo-harmony-cli install` 增加 `expo-image-picker`、`@react-native-async-storage/async-storage`、`zustand`、`zod`、`react-hook-form`(后三者为纯 JS,零原生风险);**不引入** `expo-location`、`expo-camera`、`expo-notifications`、`expo-secure-store`(RNOH 无已验证适配)。
- **配置**:`app.json` 的 `scheme`、`package`/`bundleName` 改为正式标识;新增 `.env` 机制但**不提交真实地址**。
- **不受影响**:Metro/RNOH 托管文件(`metro.config.js`、`index.harmony.js`、`scripts/*harmony*`、`patches/`、`shims/`、`.expo-harmony/managed-state.json`)由 CLI 维护,不手工改。
- **风险**:发布与详情依赖的地图/定位一期不做,城市靠手选;推送一期只做到前台实时,离线不可达需在 UI 明示;`harmony/` 工程尚未 `prebuild`,codegen 当前不可用。
