## ADDED Requirements

### Requirement: 验证码登录为主入口

`app/auth/login.tsx` SHALL 以"手机号 + 6 位验证码"为默认方式,并提供折叠的账号密码方式。验证码倒计时 SHALL 为 60 秒且基于服务端剩余有效期校准;连续错误 SHALL 升级为图形验证码。页面 MUST 明示"未注册手机号验证通过即自动创建账号"。

#### Scenario: 验证码倒计时与重发

- **WHEN** 用户点击获取验证码成功
- **THEN** 按钮进入 60 秒禁用倒计时,期间重复点击不发起请求,倒计时结束恢复"重新获取"

#### Scenario: 错误次数超限要求图形验证

- **WHEN** 同一手机号连续 3 次验证码错误
- **THEN** 表单出现图形验证码要求,不通过则不允许再次提交短信验证码

#### Scenario: 自动建档后引导完善资料

- **WHEN** 未注册手机号验证通过并拿到 token(`isNewUser=true`)
- **THEN** 应用直接进入主界面,同时以非阻断方式引导完善身份类型与常驻地,跳过不影响浏览与发布

### Requirement: 会话恢复与路由守卫

根布局 SHALL 在启动时读取本地 token 并调用 `GET /app/auth/me` 判定进入 `(tabs)` 还是 `/auth/login`。写操作入口(发布、线索、收藏、消息)MUST 要求登录;浏览广场与详情 SHALL 允许未登录访问。

#### Scenario: 未登录可浏览广场

- **WHEN** 冷启动时不存在 token,用户直接点击广场
- **THEN** 广场与档案详情正常展示,不强制登录

#### Scenario: 未登录点发布被引导

- **WHEN** 未登录用户点击"发布寻人"
- **THEN** 跳登录页并携带回跳目标,登录成功后回到发布第一步且已填内容不丢

### Requirement: 资料与账号安全

`app/me/profile-edit.tsx` SHALL 支持昵称、头像、身份类型(`GUARDIAN|VOLUNTEER|PUBLIC`)、常驻地;`app/me/security.tsx` SHALL 支持改密、换绑手机、退出登录、申请注销并展示 15 日冷静期说明。头像上传 MUST 走统一上传接口并做客户端压缩。

#### Scenario: 注销前告知影响

- **WHEN** 用户点击注销账号
- **THEN** 明确展示其发布档案将被清除识别信息、冷静期内登录可撤销,二次确认后才提交

#### Scenario: 换绑手机需双重验证

- **WHEN** 用户更换手机号
- **THEN** 需通过原手机号或密码验证其一,再对新号验证短信码

### Requirement: 身份与角色差异

应用 SHALL 依据 `identityType` 调整入口:家属可见"我的发布/续期/找回",志愿者额外可见"待核实线索"标记,普通用户只见"我的线索"与收藏。角色差异 MUST NOT 成为浏览限制。

#### Scenario: 普通用户无发布管理入口

- **WHEN** `identityType=PUBLIC` 的用户进入"我的"
- **THEN** 不出现"我发布的档案"分组,但广场、详情、消息、我的线索仍可用
