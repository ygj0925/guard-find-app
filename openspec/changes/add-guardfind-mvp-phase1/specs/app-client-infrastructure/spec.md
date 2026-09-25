## ADDED Requirements

### Requirement: 集中式环境配置

应用 SHALL 通过 `lib/env.ts` 从 `app.config.ts` 的 `extra` 与 `process.env.EXPO_PUBLIC_*` 读取 `API_BASE_URL`、`WS_BASE_URL`、`ENV_NAME`,业务代码 MUST NOT 出现硬编码的 host 或端口。真实地址文件 MUST NOT 提交进仓库,仓库内只保留 `.env.example`。生产构建 SHALL 强制 HTTPS。

#### Scenario: 缺失基址时构建失败而非静默

- **WHEN** 构建时未提供 `EXPO_PUBLIC_API_BASE_URL`
- **THEN** 应用启动即抛出可读的配置错误,不发出任何指向猜测地址的请求

#### Scenario: 三端共用同一份配置

- **WHEN** 分别以 iOS、Android、HarmonyOS 平台启动
- **THEN** `lib/env` 返回同一基址,无需平台专属分支

### Requirement: 统一 API 客户端

应用 SHALL 提供 `lib/api/client.ts`,基于原生 `fetch`(不引入需原生支持的 HTTP 库),负责:注入 `Authorization` 头、按 `{code,msg,data}` 解包、`code != 0` 抛类型化 `ApiError{code,msg,bizCode}`、网络层错误与超时区分、401 触发一次会话清理与跳转登录。所有接口 SHALL 在 `lib/api/endpoints/*.ts` 中集中声明请求与响应类型,页面 MUST NOT 手写裸路径。

#### Scenario: 业务错误携带可读消息

- **WHEN** 服务端返回 `code=1`、`msg="验证码已失效"`
- **THEN** 调用方捕获到 `ApiError`,页面直接展示该 `msg` 而非通用"请求失败"

#### Scenario: 401 只登出一次

- **WHEN** 并发 3 个请求全部返回未授权
- **THEN** 会话清理与登录跳转只发生一次,不产生 3 次重复导航

#### Scenario: 请求超时可控

- **WHEN** 请求超过 15 秒未响应
- **THEN** 客户端主动中断并返回超时错误,页面展示重试入口而非无限 loading

### Requirement: 凭据存储的平台分派

应用 SHALL 通过 `lib/storage/token.ts` 读写会话 token,接口对上层透明。iOS/Android SHALL 使用系统安全存储,HarmonyOS SHALL 使用已在 RNOH 验证过的方案或应用私有目录文件,并 MUST NOT 因缺失原生模块而在启动阶段崩溃(顶层不得调用 `requireNativeModule`)。

#### Scenario: 冷启动恢复会话

- **WHEN** 用户登录后杀掉进程再冷启动
- **THEN** token 从存储读回并通过 `GET /app/auth/me` 校验,直接进入主界面,不闪回登录页

#### Scenario: 存储不可用时降级为未登录

- **WHEN** 存储读取抛异常
- **THEN** 应用按未登录处理并展示登录页,不白屏、不崩溃

### Requirement: 状态管理与数据获取

应用 SHALL 使用纯 JS 状态库(`zustand`)管理会话与全局态,列表数据 SHALL 由 `hooks/useRequest` 统一封装(加载/错误/重试/分页/竞态丢弃)。MUST NOT 让后到的旧响应覆盖新响应。

#### Scenario: 快速切换城市时丢弃过期响应

- **WHEN** 用户在 200ms 内先后切到城市 A 再切到城市 B,而 A 的响应后到
- **THEN** 界面只展示 B 的数据,A 的响应被丢弃

### Requirement: 全局错误边界与上报

应用 SHALL 在根布局包裹 ErrorBoundary 并提供可重试的兜底 UI(鸿蒙无 JS 红框,必须有)。系统 SHALL 提供 `lib/monitor.ts` 收集非致命错误并批量 `POST /app/client-log`,上报 MUST NOT 携带 token、手机号、身份证等敏感值。

#### Scenario: 子树崩溃不导致白屏

- **WHEN** 某个页面组件渲染抛异常
- **THEN** 仅该子树被兜底 UI 替换,Tab 栏与导航仍可用,用户可返回

#### Scenario: 上报内容脱敏

- **WHEN** 错误对象中包含手机号样式的字符串
- **THEN** 上报前被掩码处理

### Requirement: 质量基线脚本

仓库 SHALL 提供可 CI 执行的脚本:`typecheck`(`tsc --noEmit`)、`test:ci`(`jest --ci`,替换现有 `--watchAll` 的 `test`)、`lint`(需提交真实 eslint 配置)。`tailwind.config.js` SHALL 补齐动画插件并把 `lib`、`hooks`、`store` 纳入 content glob。

#### Scenario: 骨架屏动画真实生效

- **WHEN** 渲染使用 `animate-pulse` 的骨架屏
- **THEN** 出现可见的呼吸动画(当前配置下 `plugins: []` 使其静止)

#### Scenario: 类型错误阻断合并

- **WHEN** 提交包含 TS 类型错误的代码
- **THEN** `pnpm typecheck` 以非零退出码失败
