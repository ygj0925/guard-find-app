## ADDED Requirements

### Requirement: 原生依赖引入流程

任何新增原生依赖 MUST 通过 `pnpm dlx expo-harmony-cli install <pkg>` 安装,MUST NOT 使用 `pnpm add`、`expo install` 或 `expo prebuild`(它们不维护鸿蒙 patch、alias、原生注册与托管状态)。引入前 SHALL 检查 RNOH 三方库总览并优先选择 `@react-native-ohos/*`(RN 0.77),并 SHALL 对包内 `build/*.js` 执行 `requireNativeModule` 顶层调用审计。

#### Scenario: 顶层加载原生模块的包不得直接引入

- **WHEN** 候选包的 JS 入口在顶层执行 `requireNativeModule('ExpoXXX')`
- **THEN** 不直接引入该包;若必需则先提供 harmony 侧 mock 分派实现,并在规格或 README 记录适配代价

#### Scenario: 误用被禁命令后可恢复

- **WHEN** 有人用 `pnpm add` 装了原生包
- **THEN** 修复流程为 `pnpm install && expo-harmony-cli scan && expo-harmony-cli sync`,并在提交前确认托管状态文件一致

### Requirement: 平台能力分派层

所有平台相关能力 SHALL 经 `lib/capabilities/` 分派(token 存储、图片选取、图片压缩、分享、剪贴板),通过 `.harmony.ts` / `.harmony.tsx` 文件后缀或运行时 `Platform.OS === 'harmony'` 选择实现。业务页面 MUST NOT 直接判断平台。任一能力在无原生支持的平台上 SHALL 返回可识别的"不支持"结果,由调用方展示降级 UI。

#### Scenario: 鸿蒙上图片选取失败可识别

- **WHEN** 鸿蒙侧图片选取能力不可用
- **THEN** 调用方拿到 `unsupported` 结果并展示"当前设备暂不支持选择图片,可稍后在草稿箱继续",App 不崩溃

#### Scenario: 三端同一页面代码

- **WHEN** 发布表单在三端渲染
- **THEN** 页面组件无 `Platform.OS` 分支,平台差异只存在于 `lib/capabilities` 内

### Requirement: 远程图片不依赖 expo-asset

应用 SHALL 使用 `react-native` 原生 `Image` 与 `uri` 加载远程图片。MUST NOT 依赖 `expo-asset`、`Asset.downloadAsync` 或 `expo-image` 的远程资源加载路径(鸿蒙侧 `expo-asset` 已被 shim 为 no-op,依赖它将导致图片静默不显示)。

#### Scenario: 广场卡片图片三端可见

- **WHEN** 三端加载同一张服务端返回的远程图片
- **THEN** 均能显示,且加载失败时有占位图而非空白

### Requirement: 定位与推送一期不使用

一期 MUST NOT 引入 `expo-location`、`expo-camera`、`expo-notifications`、`expo-secure-store`、`expo-file-system`(RNOH 无已验证适配)。就近检索 SHALL 用城市手选实现;通知 SHALL 用站内信 + WebSocket + 轮询实现;档案详情地图入口 SHALL 以"敬请期待"占位而非隐藏功能语义。

#### Scenario: 一期不申请定位权限

- **WHEN** 用户完成从登录到发布的全流程
- **THEN** 应用不出现定位权限弹窗,也不因缺权限而报错

#### Scenario: 地图入口明示未开放

- **WHEN** 用户点击详情的地图入口
- **THEN** 展示"地图定位将在后续版本提供"并给出文字地址与复制按钮

### Requirement: 构建与运行前置

文档 SHALL 说明:鸿蒙工程需先执行 `pnpm dlx expo-harmony-cli prebuild --platform harmony` 生成 `harmony/`,之后 `pnpm codegen` 与 `ohpm install` 才可用(当前仓库无 `harmony/` 目录,codegen 直接执行会失败)。iOS/Android 沿用 `pnpm expo run:android|ios`。

#### Scenario: codegen 前置缺失时给出指引

- **WHEN** 在未 prebuild 的干净仓库执行 `pnpm codegen`
- **THEN** 失败信息包含需要先执行 `prebuild --platform harmony` 的明确提示,而不是路径不存在堆栈

### Requirement: 鸿蒙无红框下的可诊断性

应用 SHALL 提供自建的可诊断能力:全局 ErrorBoundary 展示可复制的错误摘要、开发环境下从 `lib/monitor` 读取最近错误列表,MUST NOT 依赖 Metro error overlay(鸿蒙侧已被 shim 关闭)。

#### Scenario: 鸿蒙崩溃页可自证

- **WHEN** 鸿蒙设备上某子树渲染抛异常
- **THEN** 界面显示错误摘要与"复制"入口,用户能把信息提供给支持方,应用其余部分仍可用
