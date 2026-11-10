# Tasks: 天下无拐一期 MVP App

> 2026-11-10 对照代码核对:`[x]` 均有代码或测试证据;未勾项下的"注"写明残缺部分或阻塞原因。
> 实机验证与静态检查的区分见 `doc/一期实施验证报告.md` 第 8 节。

- [x] 0.1 与后端逐项确认接口契约,把结论固化到 `doc/天下无拐接口契约v1.md`(路径、方法、请求/响应字段、错误码),App 侧类型只从该文件派生

## 1. 工程基线

- [x] 1.1 `package.json` 增加 `typecheck: tsc --noEmit`,`test` 改为 `jest`,`test:ci: jest --ci --watchAll=false`
- [x] 1.2 新建 `jest.config.js`(preset `jest-expo`、setup 文件、`@testing-library/react-native` 依赖、transformIgnorePatterns 覆盖 `@rn-primitives`/`@react-native-ohos`)
  - 注:已装的 `@testing-library/react-native@14` 要求 React 19,与项目 React 18.3 不兼容;hook 单测改用 `react-test-renderer@18.3.1`。降级或移除该依赖需走 `expo-harmony-cli install`,未动。
- [x] 1.3 提交可用的 eslint 配置(含"业务代码禁 `Platform.OS` 分支""禁 import `expo-asset`""禁裸 `fetch`"三条规则)
- [x] 1.4 `tailwind.config.js` 加 `tailwindcss-animate` 插件,content 扩到 `./{app,components,lib,hooks,store}/**/*.{ts,tsx}`
- [x] 1.5 品牌 token:重写 `global.css` 与 `tailwind.config.js` 语义色(紧急红/找回绿/主色),`constants/Colors.ts` 改为从同一 token 派生;更新 `app.json` 的 `scheme`/`package`/`bundleName`/tint 与图标资源占位
- [x] 1.6 新增 `.github/workflows/ci.yml`:install → typecheck → lint → test:ci
- [x] 1.7 清理模板:删 `ParallaxScrollView`/`HelloWave`/`ThemedText`/`ThemedView`/`react-logo*`/`scripts/reset-project.js`,收敛 `IconSymbol` 图标策略,验证 `pnpm typecheck` 通过

## 2. 客户端基础设施

- [x] 2.1 `lib/env.ts` + `app.config.ts` 的 `extra` 与 `EXPO_PUBLIC_*` 读取;缺失基址时启动即报可读错误;新增 `.env.example`
- [x] 2.2 `lib/api/error.ts` 的 `ApiError{code,msg,bizCode}` 与错误码到用户文案映射
- [x] 2.3 `lib/api/client.ts`:注入 token、`{code,msg,data}` 解包、15s 超时中断、401 单次登出与回跳、网络/超时/业务错误分类
- [x] 2.4 `lib/api/endpoints/{auth,case,plaza,lead,message,me,upload}.ts`:按契约声明函数与 TS 类型,禁止页面裸路径
- [ ] 2.5 `lib/storage/token.ts`(含 `.harmony.ts` 实现)与 `lib/storage/kv.ts`;冷启动恢复、异常降级为未登录
  - 注:异常降级已实现并有单测(`lib/storage/__tests__/token-core.test.ts`)。`@react-native-async-storage/async-storage@1.23.1` 已经 CLI 安装,`lib/storage/native-kv-driver.ts` 在 iOS/Android 上作为默认 kv 驱动(持久,需重建原生壳),有单测 `native-kv-driver.test.ts`。缺:CLI 提示该包"未自动适配 HarmonyOS",鸿蒙由 `native-kv-driver.harmony.ts` 返回 null,仍落内存驱动(`kv-memory`),杀进程后 token 与草稿丢失;没有 `token.harmony.ts`;iOS/Android 冷启动恢复未实机验证。
- [x] 2.6 `lib/capabilities/`:`image-picker`、`image-compress`、`share`、`clipboard` 的接口 + 默认实现 + `.harmony.ts` 分派 + `unsupported` 结果类型
- [x] 2.7 `store/session.ts`(zustand):token、用户信息、身份类型、常驻地、未读数
- [x] 2.8 `hooks/useRequest.ts` + `hooks/useFeed.ts`:加载/错误/重试、游标分页、竞态丢弃、切流保留游标
- [x] 2.9 `lib/monitor.ts` 错误收集与敏感值掩码 + `providers/ErrorBoundary.tsx`(可复制错误摘要、重试入口)
- [x] 2.10 重写 `app/_layout.tsx`:修空 `useEffect`、加 `GestureHandlerRootView` + `SafeAreaProvider` + ErrorBoundary + 会话恢复判定
- [x] 2.11 补齐 UI 原语:`form`(react-hook-form + zod)、`toast`、`sheet/drawer`、`date-time-picker`、`pagination` 中实际需要的部分
- [x] 2.12 单测:client 解包与 401 单次、超时、useRequest 竞态、useFeed 不重不漏、token 存储降级、monitor 掩码
  - 证据:`lib/api/__tests__/client-test.ts`(含超时/取消/网络三分类)、`hooks/__tests__/request-feed.test.tsx`、`lib/storage/__tests__/token-core.test.ts`、`lib/__tests__/monitor.test.ts`。写掩码单测时查出两个 bug,已修:空格分隔的手机号没打码;身份证中段先被手机号规则吃掉。

## 3. 路由骨架

- [ ] 3.1 `app/(tabs)/_layout.tsx` 五 Tab(广场/发布/社区占位/消息/我的)+ 未读角标 + `harmony` 可用的 tabBar 实现
  - 注:五 Tab、`FloatingTabBar` 与未读角标(已封顶为 99+,未登录不显示)都已在代码里;只缺鸿蒙实机渲染验证(见 8.3)。
- [x] 3.2 `app/auth/`(login、profile-setup)、`app/case/[id]/`(index、lead、leads)、`app/publish/`(index、case、drafts)、`app/me/`(index、profile-edit、security、cases、leads、favorites、notification-pref)、`app/search.tsx`
  - 注:`publish/index` 与 `me/index` 落在 `app/(tabs)/` 下的同名 Tab 页。
- [ ] 3.3 路由守卫与回跳:写操作未登录跳登录并携带目标,登录后恢复上下文(含已填表单内容)
  - 注:`lib/nav.ts` 已实现 redirect 拼接与解析,表单内容保存在 store 里;回跳上下文已有 `login-rules.test.ts` 覆盖(见 4.5)。残留:鸿蒙端 kv 是内存驱动,杀进程后表单内容不保留(见 2.5)。
- [x] 3.4 社区 Tab 一期占位页:明示"后续版本开放",不做半成品列表
  - 注:已取代,不再执行(勾选只表示关闭本条,不代表做了占位页)。社区功能(`app/community`、`/app/post/*`)已经上线,Tab 文案改为"社区",不再是占位页。

## 4. 登录与会话

- [x] 4.1 登录页:手机号 + 验证码主路径、60s 倒计时按服务端剩余有效期校准、错误分级升级图形验证、密码方式折叠
  - 证据:`app/auth/login.tsx`。倒计时取 `min(60, sms-code 响应的 expireSeconds)`(`hooks/useCountdown.ts` 的 `resendCooldownSeconds`,服务端 `AppSmsCodeResp.expireSeconds` 已下发)。图形验证码取自公开的 `GET /captcha/image`,`uuid` 作 `captchaId`,每次失败后重新取图;服务端提示"请输入图形验证码"时直接进入图形验证(重进页面本地计数归零的情况)。
  - 本轮修复:原实现把用户输入同时当 `captchaId` 和 `captchaValue` 发出,服务端按 `CAPTCHA:{captchaId}` 取不到缓存,连错 3 次后该手机号无法再用验证码登录。服务端同时改为遵守 `LOGIN_CAPTCHA_ENABLED` 开关(关闭时取图接口不下发图片,原先仍强制校验)。
  - 残留:仅静态检查与服务端单测,未在设备或浏览器实机走过图形验证码这条路径。
- [x] 4.2 明示"未注册手机号验证通过即自动建档";`isNewUser` 时非阻断引导完善身份与常驻地
- [ ] 4.3 会话恢复:启动即 `GET /app/auth/me`,失败清 token;`app/me/security` 退出登录
  - 注:逻辑在 `store/session.ts`,Web 端可用。iOS/Android 的 token 已落 async-storage,冷启动恢复未实机验证;鸿蒙仍是内存驱动,冷启动必然是未登录(见 2.5)。
- [ ] 4.4 资料编辑与头像上传(压缩 + 能力分派)、换绑手机(双重验证)、注销申请与冷静期提示
  - 注:资料编辑、头像上传、注销申请与冷静期提示已实现。换绑手机未做,契约 v1 没有对应接口;原生端的压缩依赖未安装的 `expo-image-manipulator`,走的是 unsupported 降级。
- [x] 4.5 单测:倒计时禁用与重复点击、错误 3 次后要求图形验证、登录回跳携带内容、注销二次确认
  - 证据:登录页与安全页的状态逻辑抽到 `lib/auth/login-rules.ts`,两页改为调用它;单测 `lib/auth/__tests__/login-rules.test.ts` 覆盖冷却秒数、请求未返回前的重复点击不发请求(本轮修复:原先连点会重复发短信)、第 3 次错误进图形验证、锁定/断网/密码登录不计数、redirect 优先并保留收藏动作、注销原因为空与未勾选"我已知悉"不提交(本轮修复:原先可绕过)。
  - 残留:逻辑层单测,页面组件本身没有测试(RNTL 与 React 18 不兼容,见 1.2)。换绑手机属于 4.4,仍未做。

## 5. 广场与详情

- [x] 5.1 四流切换与城市选择器(常驻地优先,未设置手选),各流独立游标与滚动位置
  - 证据:四流切换、城市选择、各流独立游标已实现,城市并入 slot 键(修了换城市后列表不刷新)。`hooks/useFeed.ts` 的 phase/error 改为按 slot 存放,旧流迟到的回包只写回旧流(单测 `request-feed.test.tsx`「phase/error 按 slot 隔离」)。`app/(tabs)/plaza.tsx` 按 slot 记录滚动偏移,切回时 `scrollToOffset` 恢复。
  - 残留:滚动位置恢复只做了静态检查,未在设备或浏览器实机验证。
- [x] 5.2 卡片渲染:脱敏字段、紧急"已失踪 N 小时"文字与倒计时(不只靠颜色)、图片失败占位
- [x] 5.3 下拉刷新、触底加载、四态(加载/空/失败重试/无更多)与骨架屏
- [x] 5.4 筛选面板(选项来自 `GET /app/plaza/filters`,不硬编码)与筛选叠加正确
  - 证据:选项来自接口。原实现有筛选时改走 `/app/search`,而服务端搜索要求关键词,广场筛选实际不可用;现在服务端 `GET /app/plaza/feed` 接收与搜索相同的筛选参数并在所选流内叠加(契约 3.1 已同步),App 始终走 feed、带上 sort 与非空筛选项。单测 `lib/api/__tests__/plaza-feed-contract-test.ts`。
  - 残留:服务端筛选只编译通过,未连库实测。
- [ ] 5.5 搜索页:历史(可清空)、热词、服务端校验错误原因展示
  - 注:历史记录(可清空)和错误原因展示已实现。热词未做,契约 v1 没有热词接口。
- [x] 5.6 详情页:完整体貌与情境、区县级地址、"提交线索"主 CTA、防骗常驻提示、收藏、分享、地图入口明示未开放 + 复制地址
- [x] 5.7 `GET /app/plaza/statistics` 首屏信任数据展示
- [x] 5.8 单测:切流保位、筛选叠加、`hasMore=false` 不再请求、失败重试保留数据、未登录收藏引导
  - 证据:`hasMore=false` 不再请求、失败保留数据、切流保留游标与 phase/error 隔离由 `hooks/__tests__/request-feed.test.tsx` 覆盖;筛选叠加的请求参数由 `plaza-feed-contract-test.ts` 覆盖;未登录收藏引导由 `store/__tests__/favorites.test.ts` 覆盖(记录回跳与待补做动作、只消费一次、登录后补做)。本轮修复:登录后补做收藏走的是切换,本机已收藏时会被反向取消;现在 `store/favorites.ts` 只在未收藏时补做。`favoriteRunId` 移到 `lib/nav.ts`。
  - 残留:滚动位置恢复在页面组件里,没有单测。

## 6. 发布流程

- [ ] 6.1 五步表单骨架与分步校验(zod schema + `form` 原语),错误定位到字段,上一步不重置
  - 注:五步表单、zod 分步校验、上一步不重置都已实现。区划字段的错误原先只读 `cityCode`,已改为同时显示 `provinceCode`;分步校验、字段错误及前进后退已有单测(见 6.7)。残留:页面组件的字段错误展示及定位未实机走查。
- [ ] 6.2 步骤内容:基本信息(含别名增删、至少 1 图)、时空(日期时间选择器禁未来、省市区三级)、体貌(至少一项硬校验)、情境联络、确认发布
  - 注:各步内容已实现;区划原先显示原始编码,已改为显示名称。没有实机走查。
- [x] 6.3 第 5 步合规告知:两项强制勾选 + 协议链接 + `agreementVersion`,未勾选禁用提交
- [ ] 6.4 图片:选择(能力分派 + 9 张/5MB 即时提示)、客户端压缩到长边 1600px、上传与失败重试
  - 注:选择、数量与大小提示、上传和失败重试都已实现;修了并行上传回写旧列表、新图丢失的 bug。`expo-image-picker@16.0.6` 已经 CLI 安装,iOS/Android 走 `launchImageLibraryAsync`(懒加载,原生模块缺失降级 unsupported,失败与取消分开返回,单测 `image-picker.test.ts`)。缺:鸿蒙仍为 unsupported(见 8.1);`expo-image-manipulator` 未装,压缩只在 Web 生效;iOS/Android 选图未实机验证。
- [ ] 6.5 草稿:云端 `submit=false` + 本地暂存与恢复、离线可继续填写、冲突时选择以哪一方为准
  - 注:云端草稿、本地暂存、冲突选择都已实现,并由 `store/__tests__/publish-form.test.ts` 覆盖。修了三个 bug:冲突对话框永远不会触发;用户还没选就先覆盖了本地值;装载其他档案时串档(关系和区划被沿用)。缺:鸿蒙端本地暂存是内存驱动,杀进程不能恢复(见 2.5)。
- [ ] 6.6 我的档案:`app/me/cases` 按状态分组;驳回展示模板理由并"修改后重新提交"预填;续期/撤回/标记找回(需选依据)/申请删除(二次确认)
  - 注:分组、续期、撤回、标记找回、申请删除都已实现。"修改后重新提交"进入 `/publish/case?caseId=…`,由 `loadCloudDraft` 预填同一份档案;未接线的 `prefillFromCase` 已删除。修了一个 bug:已有档案重新提交只调 `PUT`,服务端不会因此改状态,驳回件和云端草稿永远到不了 `PENDING_REVIEW`;现在先 `PUT` 保存再 `POST /app/find/case/{id}/submit`(带 `forceSubmit`)。
  - 缺:驳回只展示 `auditRemark` 原文,没有模板理由(服务端没有下发模板理由字段)。
- [x] 6.7 单测:分步校验与不重置、缺体貌阻断、未勾选禁用提交、断网续填恢复、驳回预填
  - 证据:`lib/publish/__tests__/schema.test.ts` 覆盖五步校验、错误定位到字段、禁未来时间、缺体貌阻断、两项合规任一未勾选不能提交;`store/__tests__/publish-form.test.ts` 覆盖冲突与防串档、云端(驳回)预填、重新提交走 update + submit,以及「分步前进后退与离线续填」(校验不过不前进、退回只清错误、防抖写本地后重启恢复到原步骤并标记待同步)。
  - 残留:逻辑层单测;鸿蒙本地暂存仍是内存驱动(见 2.5)。

## 7. 线索与消息

- [ ] 7.1 线索提交表单(时间/地点/描述字数校验/图片 ≤3/联系方式默认 `IN_APP`)、常驻防骗提示、成功反馈
  - 注:代码已实现(`app/case/[id]/lead.tsx`、`lib/lead`)。原生端图片能力的限制同 6.4。没有实机走查。
- [x] 7.2 家属侧线索列表(仅所有人可见、`highRisk` 显著"待核实"、状态标注、回复)
- [x] 7.3 消息中心:分组列表、未读筛选、单条与全部已读、Tab 角标即时同步、按 `path` 跳转业务页
- [x] 7.4 `lib/realtime.ts`:WebSocket 连接与鉴权失败处理、断开降级 30s 未读轮询、后台停轮询、回前台补拉
  - 证据:连接、30s 降级轮询、前后台切换已实现。鉴权失败单独处理:服务端连上后以 1008 关闭(登录态无法识别 / 会话数超限)时停止 WS 重连、立即改轮询;握手被拒(HTTP 401)在客户端表现为未 open 即 close,连续 3 次按鉴权失败处理;回前台或重新登录时复位再试。日志只记关闭码与原因,不含 token 和地址。单测 `lib/__tests__/realtime-close-test.ts`。
  - 残留:未连真实 WS 服务实测。
- [x] 7.5 通知偏好页:审核结果类只读禁用 + 说明,`CASE_LEAD` 短信默认关闭与费用提示;一期明示"关闭 App 后可能收不到实时提醒"
  - 证据:已逐条对照 `specs/app-lead-and-messages/spec.md`「通知偏好设置」:`inboxForced` 行开关禁用并显示"审核结果必须送达,不支持在 App 内关闭",保存时强制行永远带 `inboxEnabled=true`;短信位取服务端值(默认关闭),提示优先用 `smsNote`,兜底为运营商计费说明,`CASE_LEAD` 另有打扰提示;页顶常驻 `PUSH_LIMIT_NOTE`("App 关闭后可能收不到实时提醒")。
  - 残留:"短信默认关闭"依赖服务端返回的初始值;页面没有单测。
- [x] 7.6 我的线索与收藏列表 + 空态引导
- [x] 7.7 单测:描述过短阻止、越权线索无权限态、已读与角标一致、断线降级与去重提示
  - 证据:`lib/lead/__tests__/schema.test.ts`(描述不足 10 字阻断、图片 ≤3、站内联系不上送电话;4003 与 403 进入无权限态);`lib/message/__tests__/read-sync.test.ts`(单条/全部已读只改本地对应项、角标同步、失败不改);`lib/__tests__/realtime-dedupe-test.ts`(同一消息重复到达只回调一次、角标只 +1);断线降级见 `realtime-close-test.ts`。本轮修复:服务端线索列表越权原先走通用业务校验异常,App 无法与普通失败区分;现在返回业务码 4003(契约已写明),`app/case/[id]/leads.tsx` 按 `lib/lead/access.ts` 统一判定无权限态;消息已读逻辑抽到 `lib/message/read-sync.ts`。
  - 残留:逻辑层单测,未连真实 WS 服务。

## 8. 三端与鸿蒙兼容

- [x] 8.1 依赖安装走 `pnpm dlx expo-harmony-cli install`(`async-storage`、`zustand`、`zod`、`react-hook-form`、`expo-image-picker`),逐个做 `requireNativeModule` 顶层审计并记录结论
  - 证据:五个包都经 CLI 安装。`zustand`、`zod`、`react-hook-form` 是纯 JS。审计结论:
    - `async-storage@1.23.1`:CLI 提示"未自动适配 HarmonyOS"。`lib/module/AsyncStorage.native.js` 在原生模块为空时顶层 `throw`。处理:懒 require + try/catch,鸿蒙变体不引用。
    - `expo-image-picker@16.0.6`:CLI 生成 `patches/expo-image-picker+16.0.6.patch`。iOS/Android 仍在 `ExponentImagePicker.js` 顶层 `requireNativeModule`(懒 require 兜住);鸿蒙分支转发 `@react-native-ohos/react-native-image-picker`,但该鸿蒙插件未被安装、`harmony/` 下无注册,且补丁把插件 errorCode 映射成 `canceled`。处理:`image-picker.harmony.ts` 保持 unsupported。
    - 静态证据:`bundle-harmony --dev false` 产物(5.7MB)中 `ExponentImagePicker`/`RNCAsyncStorage`/`launchImageLibraryAsync` 出现 0 次,选图实现只有 `image-picker:harmony-placeholder`。
  - 残留:鸿蒙侧两项能力都未接入;接入需先装鸿蒙插件并实机验证。CLI 安装时把 package.json 里的 `^` 区间改成了精确版本(与锁文件一致)。
- [ ] 8.2 `pnpm expo run:android` / `run:ios` 跑通核心链路(登录 → 广场 → 详情 → 发布 → 消息)
  - 注:阻塞,需要 Android/iOS 设备或模拟器。
- [ ] 8.3 `pnpm dlx expo-harmony-cli prebuild --platform harmony` 生成 `harmony/` → `ohpm install` → `pnpm start:harmony` 跑通;确认图片、token、分享三处降级不崩溃
  - 注:阻塞,需要鸿蒙设备和 DevEco 环境。
- [ ] 8.4 验证鸿蒙不支持能力时展示降级 UI 而非崩溃(图片选取失败路径专项验证)
  - 注:阻塞,同 8.3。

## 9. 交付核对

- [x] 9.1 `pnpm typecheck` 与 `pnpm lint` 通过
  - 证据:2026-11-10 `tsc --noEmit` 0 error;`eslint . --max-warnings=0` 0 问题。
- [x] 9.2 `pnpm test:ci` 通过并记录用例数
  - 证据:2026-11-11 `jest --ci` 32 个套件、202 个用例,全部通过;同日 `tsc --noEmit` 与 `eslint . --max-warnings=0` 均通过。
- [x] 9.3 对照 `doc/天下无拐接口契约v1.md` 逐项核对路径与字段,差异以规格为准修正
  - 证据:2026-11-10 把 App 的 auth/case/plaza/search/lead/message/notification/report/file 共 40 条调用,与 `guard-find-server` 的 `/app/**` 控制器逐条对照,方法全部一致。登录、广场 feed、档案 create/update(38 个字段)、线索提交、标记找回的请求字段均一致。
  - 修正:`POST /app/client-log` 服务端缺失,导致 monitor 每次上报都失败。已按契约在 server 补上(服务端强制掩码、按 IP 限流、可选登录、转义换行防伪造)。`GET /app/common/dict` 服务端缺失,App 也没有调用方,已删除 App 侧的死代码。
  - 残留:登录请求没有带可选的 `deviceId/platform/appVersion`(服务端可选字段,不影响登录)。
- [x] 9.4 三端运行结果按"实机验证 / 静态检查"分类写入验证报告,未验证项显式标注
  - 证据:`doc/一期实施验证报告.md` 第 8 节。
