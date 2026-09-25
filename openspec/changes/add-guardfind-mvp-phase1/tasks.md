# Tasks: 天下无拐一期 MVP App

- [ ] 0.1 与后端逐项确认接口契约,把结论固化到 `doc/天下无拐接口契约v1.md`(路径、方法、请求/响应字段、错误码),App 侧类型只从该文件派生

## 1. 工程基线

- [ ] 1.1 `package.json` 增加 `typecheck: tsc --noEmit`,`test` 改为 `jest`,`test:ci: jest --ci --watchAll=false`
- [ ] 1.2 新建 `jest.config.js`(preset `jest-expo`、setup 文件、`@testing-library/react-native` 依赖、transformIgnorePatterns 覆盖 `@rn-primitives`/`@react-native-ohos`)
- [ ] 1.3 提交可用的 eslint 配置(含"业务代码禁 `Platform.OS` 分支""禁 import `expo-asset`""禁裸 `fetch`"三条规则)
- [ ] 1.4 `tailwind.config.js` 加 `tailwindcss-animate` 插件,content 扩到 `./{app,components,lib,hooks,store}/**/*.{ts,tsx}`
- [ ] 1.5 品牌 token:重写 `global.css` 与 `tailwind.config.js` 语义色(紧急红/找回绿/主色),`constants/Colors.ts` 改为从同一 token 派生;更新 `app.json` 的 `scheme`/`package`/`bundleName`/tint 与图标资源占位
- [ ] 1.6 新增 `.github/workflows/ci.yml`:install → typecheck → lint → test:ci
- [ ] 1.7 清理模板:删 `ParallaxScrollView`/`HelloWave`/`ThemedText`/`ThemedView`/`react-logo*`/`scripts/reset-project.js`,收敛 `IconSymbol` 图标策略,验证 `pnpm typecheck` 通过

## 2. 客户端基础设施

- [ ] 2.1 `lib/env.ts` + `app.config.ts` 的 `extra` 与 `EXPO_PUBLIC_*` 读取;缺失基址时启动即报可读错误;新增 `.env.example`
- [ ] 2.2 `lib/api/error.ts` 的 `ApiError{code,msg,bizCode}` 与错误码到用户文案映射
- [ ] 2.3 `lib/api/client.ts`:注入 token、`{code,msg,data}` 解包、15s 超时中断、401 单次登出与回跳、网络/超时/业务错误分类
- [ ] 2.4 `lib/api/endpoints/{auth,case,plaza,lead,message,me,upload}.ts`:按契约声明函数与 TS 类型,禁止页面裸路径
- [ ] 2.5 `lib/storage/token.ts`(含 `.harmony.ts` 实现)与 `lib/storage/kv.ts`;冷启动恢复、异常降级为未登录
- [ ] 2.6 `lib/capabilities/`:`image-picker`、`image-compress`、`share`、`clipboard` 的接口 + 默认实现 + `.harmony.ts` 分派 + `unsupported` 结果类型
- [ ] 2.7 `store/session.ts`(zustand):token、用户信息、身份类型、常驻地、未读数
- [ ] 2.8 `hooks/useRequest.ts` + `hooks/useFeed.ts`:加载/错误/重试、游标分页、竞态丢弃、切流保留游标
- [ ] 2.9 `lib/monitor.ts` 错误收集与敏感值掩码 + `providers/ErrorBoundary.tsx`(可复制错误摘要、重试入口)
- [ ] 2.10 重写 `app/_layout.tsx`:修空 `useEffect`、加 `GestureHandlerRootView` + `SafeAreaProvider` + ErrorBoundary + 会话恢复判定
- [ ] 2.11 补齐 UI 原语:`form`(react-hook-form + zod)、`toast`、`sheet/drawer`、`date-time-picker`、`pagination` 中实际需要的部分
- [ ] 2.12 单测:client 解包与 401 单次、超时、useRequest 竞态、useFeed 不重不漏、token 存储降级、monitor 掩码

## 3. 路由骨架

- [ ] 3.1 `app/(tabs)/_layout.tsx` 五 Tab(广场/发布/社区占位/消息/我的)+ 未读角标 + `harmony` 可用的 tabBar 实现
- [ ] 3.2 `app/auth/`(login、profile-setup)、`app/case/[id]/`(index、lead、leads)、`app/publish/`(index、case、drafts)、`app/me/`(index、profile-edit、security、cases、leads、favorites、notification-pref)、`app/search.tsx`
- [ ] 3.3 路由守卫与回跳:写操作未登录跳登录并携带目标,登录后恢复上下文(含已填表单内容)
- [ ] 3.4 社区 Tab 一期占位页:明示"后续版本开放",不做半成品列表

## 4. 登录与会话

- [ ] 4.1 登录页:手机号 + 验证码主路径、60s 倒计时按服务端剩余有效期校准、错误分级升级图形验证、密码方式折叠
- [ ] 4.2 明示"未注册手机号验证通过即自动建档";`isNewUser` 时非阻断引导完善身份与常驻地
- [ ] 4.3 会话恢复:启动即 `GET /app/auth/me`,失败清 token;`app/me/security` 退出登录
- [ ] 4.4 资料编辑与头像上传(压缩 + 能力分派)、换绑手机(双重验证)、注销申请与冷静期提示
- [ ] 4.5 单测:倒计时禁用与重复点击、错误 3 次后要求图形验证、登录回跳携带内容、注销二次确认

## 5. 广场与详情

- [ ] 5.1 四流切换与城市选择器(常驻地优先,未设置手选),各流独立游标与滚动位置
- [ ] 5.2 卡片渲染:脱敏字段、紧急"已失踪 N 小时"文字与倒计时(不只靠颜色)、图片失败占位
- [ ] 5.3 下拉刷新、触底加载、四态(加载/空/失败重试/无更多)与骨架屏
- [ ] 5.4 筛选面板(选项来自 `GET /app/plaza/filters`,不硬编码)与筛选叠加正确
- [ ] 5.5 搜索页:历史(可清空)、热词、服务端校验错误原因展示
- [ ] 5.6 详情页:完整体貌与情境、区县级地址、"提交线索"主 CTA、防骗常驻提示、收藏、分享、地图入口明示未开放 + 复制地址
- [ ] 5.7 `GET /app/plaza/statistics` 首屏信任数据展示
- [ ] 5.8 单测:切流保位、筛选叠加、`hasMore=false` 不再请求、失败重试保留数据、未登录收藏引导

## 6. 发布流程

- [ ] 6.1 五步表单骨架与分步校验(zod schema + `form` 原语),错误定位到字段,上一步不重置
- [ ] 6.2 步骤内容:基本信息(含别名增删、至少 1 图)、时空(日期时间选择器禁未来、省市区三级)、体貌(至少一项硬校验)、情境联络、确认发布
- [ ] 6.3 第 5 步合规告知:两项强制勾选 + 协议链接 + `agreementVersion`,未勾选禁用提交
- [ ] 6.4 图片:选择(能力分派 + 9 张/5MB 即时提示)、客户端压缩到长边 1600px、上传与失败重试
- [ ] 6.5 草稿:云端 `submit=false` + 本地暂存与恢复、离线可继续填写、冲突时选择以哪一方为准
- [ ] 6.6 我的档案:`app/me/cases` 按状态分组;驳回展示模板理由并"修改后重新提交"预填;续期/撤回/标记找回(需选依据)/申请删除(二次确认)
- [ ] 6.7 单测:分步校验与不重置、缺体貌阻断、未勾选禁用提交、断网续填恢复、驳回预填

## 7. 线索与消息

- [ ] 7.1 线索提交表单(时间/地点/描述字数校验/图片 ≤3/联系方式默认 `IN_APP`)、常驻防骗提示、成功反馈
- [ ] 7.2 家属侧线索列表(仅所有人可见、`highRisk` 显著"待核实"、状态标注、回复)
- [ ] 7.3 消息中心:分组列表、未读筛选、单条与全部已读、Tab 角标即时同步、按 `path` 跳转业务页
- [ ] 7.4 `lib/realtime.ts`:WebSocket 连接与鉴权失败处理、断开降级 30s 未读轮询、后台停轮询、回前台补拉
- [ ] 7.5 通知偏好页:审核结果类只读禁用 + 说明,`CASE_LEAD` 短信默认关闭与费用提示;一期明示"关闭 App 后可能收不到实时提醒"
- [ ] 7.6 我的线索与收藏列表 + 空态引导
- [ ] 7.7 单测:描述过短阻止、越权线索无权限态、已读与角标一致、断线降级与去重提示

## 8. 三端与鸿蒙兼容

- [ ] 8.1 依赖安装走 `pnpm dlx expo-harmony-cli install`(`async-storage`、`zustand`、`zod`、`react-hook-form`、`expo-image-picker`),逐个做 `requireNativeModule` 顶层审计并记录结论
- [ ] 8.2 `pnpm expo run:android` / `run:ios` 跑通核心链路(登录 → 广场 → 详情 → 发布 → 消息)
- [ ] 8.3 `pnpm dlx expo-harmony-cli prebuild --platform harmony` 生成 `harmony/` → `ohpm install` → `pnpm start:harmony` 跑通;确认图片、token、分享三处降级不崩溃
- [ ] 8.4 验证鸿蒙不支持能力时展示降级 UI 而非崩溃(图片选取失败路径专项验证)

## 9. 交付核对

- [ ] 9.1 `pnpm typecheck` 与 `pnpm lint` 通过
- [ ] 9.2 `pnpm test:ci` 通过并记录用例数
- [ ] 9.3 对照 `doc/天下无拐接口契约v1.md` 逐项核对路径与字段,差异以规格为准修正
- [ ] 9.4 三端运行结果按"实机验证 / 静态检查"分类写入验证报告,未验证项显式标注
