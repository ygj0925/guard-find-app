## Context

`guard-find-app` 的既有资产只有两块:**鸿蒙工具链**(RNOH 0.77.71 锁 RN 0.77.1、三端 `metro.config.js`、5 个 patch、2 个 shim、`.expo-harmony/managed-state.json`、6 个已验证的 `@react-native-ohos` 伴生包、`.agent/skills/expo-harmony-adapter` 兼容矩阵)与 **UI 底座**(react-native-reusables 31 个原语 + NativeWind 4 + HSL 语义 token + `cn()` + Lucide `Icon`)。业务侧为零:`lib/` 仅 6 行、`hooks/` 全模板、`app/` 245 行模板页、`assets/` 是与 `adaptive-icon.png` 同 md5 的默认图、唯一测试是模板组件快照、无 CI。

关键现状(实测,非文档转述):

- `shims/.alias-map.json` 把 `expo-asset` 换成 no-op shim → 鸿蒙侧远程 asset 下载不可用。
- `shims/expo-metro-runtime.ts` 关掉了鸿蒙侧 error overlay → 无红框。
- `app/_layout.tsx` 的 `useEffect` 被 CLI 改坏(空体 + 悬括号),且缺 `GestureHandlerRootView` / `SafeAreaProvider`。
- `explore.tsx` 引用 `SpaceMono` 但未装 `expo-font` → 字体不生效。
- `tailwind.config.js` `plugins: []`(`skeleton.tsx` 的 `animate-pulse` 静止),content glob 不含 `lib`/`hooks`/`shims`。
- `package.json`:`test` 是 `jest --watchAll`(不可 CI),无 `typecheck`,`codegen` 引用尚不存在的 `harmony/` 路径。
- 兼容矩阵中 `expo-location`、`expo-camera`、`expo-file-system`、`expo-splash-screen`、`expo-blur` **无已验证鸿蒙适配**;`expo-clipboard`、`expo-linear-gradient` 有简单 patch 路径;`expo-image-picker` 复杂但可行。

## Goals / Non-Goals

**Goals:**

- 一期闭环的 App 侧:验证码登录 → 五步发布 → 广场四流与详情 → 提交/处置线索 → 消息中心与角标 → 我的(档案/线索/收藏/偏好)。
- 一套可扩展的客户端基础设施(env、API 客户端、token 存储、状态、请求封装、错误边界、能力分派)。
- 三端可运行,且鸿蒙侧任何能力缺失都表现为**可识别的降级**而不是崩溃或静默失效。
- 补齐质量门禁(typecheck / CI 安全的 test / eslint / 动画插件)。

**Non-Goals:**

- 地图与定位、厂商推送、社区(帖子/评论/关注)、SOS、人脸识别、多语言、深色模式的精细化(一期跟随系统,不逐页校色)。
- 引入任何未经验证的原生依赖。

## Decisions

**D1 — HTTP 用原生 `fetch` 自建客户端,不引 axios。**
理由:少一个依赖、零原生风险、鸿蒙无差异;ContiNew 的 `{code,msg,data}` 解包与 401 处理逻辑本就只需几十行。备选(axios)被否:拦截器带来的收益抵不过新增依赖的适配审查成本。

**D2 — 状态管理用 `zustand`,服务端态用自建 `useRequest`,不引 react-query。**
一期只有 5 类接口需要缓存,`useRequest`(含竞态丢弃、分页游标、失效重拉)足够且可测。备选(`@tanstack/react-query`)在二期数据面变大后再评估,它的体积与心智成本在一期不划算。**注:此决策需在二期复审。**

**D3 — 平台差异全部收进 `lib/capabilities/`,用 `.harmony.ts(x)` 文件后缀分派。**
这是 RNOH 官方推荐且本项目 `metro.config.js` 已支持的路径(`RN_BUNDLE_PLATFORM=harmony`),零 Metro 配置改动。业务代码禁止 `Platform.OS` 分支,保证鸿蒙差异可在一处审计与回归。

**D4 — token 存储:抽象 `lib/storage/token.ts`,iOS/Android 走 Keychain/Keystore 类方案,鸿蒙走应用私有目录文件。**
`expo-secure-store` 无已验证鸿蒙适配,所以不做"三端同一实现",而做"同一接口 + 两份实现"。风险:鸿蒙侧文件存储强度低于系统密钥库 → 明确记录在安全说明里,并限制 token 有效期与设备数(后端 `sys_client` 已可配)。

**D5 — 一期不做地图,用"省市区三级 + 文字地址 + 城市手选"。**
后端 `gf_find_case` 已预留 `lng/lat`,二期只需补采集与检索层,不动 App 数据结构。避免为 `expo-location` 开一条未验证的适配路径。

**D6 — 通知一期为"站内信 + WebSocket + 轮询降级",并在 UI 明示局限。**
`expo-notifications` / 鸿蒙 Push Kit 一期不接。轮询只在首屏与回前台时跑,避免耗电与请求量。

**D7 — 图片:远程一律 `react-native` `Image`;选取走 `expo-image-picker`(需 `expo-harmony-cli install` 并实机验证);压缩在 JS 层用 `ImageEditor` 替代方案或后端缩放,不自建原生模块。**
`expo-asset` 在鸿蒙被 shim,任何依赖它的加载路径都会静默失效 —— 这是最容易踩的坑,写进代码规范并在 lint 层加禁 import 规则。

**D8 — 品牌 token 单一来源。**
`global.css` 的 HSL 变量作为唯一事实源,`constants/Colors.ts` 改为从同一份 token 生成,不再各自硬编码;`app.json` 的 `scheme`/`package` 与 tint 一起换掉。

**D9 — 模板清理与保留边界。**
删除 `ParallaxScrollView`、`HelloWave`、`ThemedText/ThemedView`、`react-logo*`、`scripts/reset-project.js`;**保留** `components/ui/*`(reusables 底座)、`collapsible`(有用)、`IconSymbol`(需扩图标)、`HapticTab` 待补回实现或删。`components.json` 保持不变以继续用 `shadcn add`。

**D10 — 测试用 `@testing-library/react-native` + jest-expo,重点测逻辑而非渲染。**
优先覆盖:`ApiError` 解包与 401 单次登出、游标分页去重、竞态丢弃、发布表单分步校验、能力分派的 unsupported 分支。UI 快照只做少数关键页。

## Risks / Trade-offs

- [`expo-image-picker` 鸿蒙侧未实机验证] → 通过 `lib/capabilities` 隔离,失败时发布流程降级为"仅文字 + 稍后补图",不阻断主链路;实机验证结果必须写进交付报告。
- [自建 `useRequest` 与 react-query 能力差距] → 一期接受;二期数据面扩大时复审 D2。
- [鸿蒙 token 落文件的安全强度] → 记录威胁模型,配合后端设备数与有效期策略降低泄露收益;不宣称与 Keychain 同等强度。
- [无 error overlay 导致鸿蒙排障困难] → 自建 ErrorBoundary + 可复制错误摘要 + 最近错误列表,并要求交付报告区分"实机验证"与"静态检查"。
- [五步表单状态管理复杂易丢数据] → 表单状态入 `lib/storage` 本地暂存,并用单测覆盖"中断恢复"和"回填不重置"。
- [`harmony/` 未生成导致 codegen 失败] → README 与脚本失败信息给出 prebuild 指引;一期不承诺鸿蒙打包产物。
- [接口契约漂移(前后端字段不一致)] → `lib/api/endpoints/*` 是唯一路径与类型来源,交付前逐项比对 `guard-find-server/.../specs/**`;比对结果写成清单而非口头确认。

## Migration Plan

1. 质量与配置先行:`typecheck` / `test:ci` / eslint / tailwind 插件与 glob / 品牌 token。
2. 基础设施:env → api client → storage → capabilities → store/useRequest → ErrorBoundary → 根布局重写。
3. 路由骨架:`auth` 组 + `(tabs)` 五 Tab + 详情/发布/线索/消息子路由,替换模板页并清理模板资产。
4. 业务页按登录 → 广场 → 详情 → 发布 → 线索 → 消息 → 我的 顺序接入,每页接入即补对应单测。
5. 依赖:`pnpm dlx expo-harmony-cli install` 增 `@react-native-async-storage/async-storage`、`zustand`、`zod`、`react-hook-form`、`expo-image-picker`;每装一个执行 `requireNativeModule` 审计。
6. 回滚:业务路由与 `lib/` 全为新增,可整体回退到模板基线;`app.json` 标识与 `tailwind` 变更需单独记录。

## Open Questions

- Q1:一期是否需要"未登录可发布"?当前规格要求发布必须登录(可追责是硬要求),但会提高流失。需产品确认是否加"游客发布 + 事后绑手机"。
- Q2:海报分享是否一期做?纯前端绘制可行(不新增依赖),但要设计资源。
- Q3:`IconSymbol` 目前只有 4 个硬编码 SF Symbol 路径,鸿蒙与 Android 上的图标策略需定:统一换 Lucide,还是保留双轨?
- Q4:深色模式是否要单独设计 token(现仅继承 shadcn neutral 暗色表),还是一期只保证浅色可用?
