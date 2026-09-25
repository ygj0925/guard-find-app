## ADDED Requirements

### Requirement: 线索提交表单

`app/case/[id]/lead.tsx` SHALL 收集:发现时间、发现地点、描述(10–1000 字)、最多 3 张图片、联系方式(`IN_APP` 默认 / `PHONE`)。页面 MUST 常驻防骗提示:"官方不会通过本应用收取任何费用,请勿转账、勿缴纳核实费或邮费"。提交成功 SHALL 展示"已送达家属,处理结果会通知你"并提供"我的线索"入口。

#### Scenario: 描述过短被阻止

- **WHEN** 用户填写描述不足 10 字点击提交
- **THEN** 阻止提交并提示字数要求,请求不发出

#### Scenario: 联系方式默认为应用内

- **WHEN** 用户不修改联系方式选项
- **THEN** 提交使用 `IN_APP`,家属无法看到手机号,页面明示这一差别

### Requirement: 家属侧线索列表与处置

`app/case/[id]/leads.tsx` SHALL 仅对档案所有人展示线索列表,支持按时间排序、查看图片、标注状态(`ACCEPTED|REJECTED|CONTACTED`)与回复。`high_risk` 线索 SHALL 以显著"待核实"标识区分并附防骗提示。MUST NOT 向非所有人泄露线索提交人的联系方式。

#### Scenario: 高风险线索标注待核实

- **WHEN** 某线索被服务端标记 `highRisk=true`
- **THEN** 列表项显示"待核实"徽标与警示文案,不与普通线索混排

#### Scenario: 越权访问线索列表

- **WHEN** 非所有人打开某档案的线索页
- **THEN** 服务端拒绝后页面展示无权限态,不显示任何线索内容

### Requirement: 消息中心与未读角标

`app/(tabs)/message.tsx` SHALL 展示按类型分组的消息列表(审核结果 / 线索 / 找回与临期 / 系统公告),支持未读筛选、单条已读、全部已读,并在 Tab 上显示与服务端一致的未读角标。点击消息 SHALL 按 `path` 跳转到对应业务页。

#### Scenario: 打开详情即标记已读且角标同步

- **WHEN** 用户点击一条未读消息进入详情
- **THEN** 该条转已读,Tab 角标数值即时减 1,无需重启

#### Scenario: 全部已读不丢焦点

- **WHEN** 用户点击"全部已读"
- **THEN** 列表保留当前分类与位置,不整页刷新

### Requirement: 实时到达与降级轮询

应用 SHALL 维持 `wss://{host}/websocket?token=` 连接接收实时消息;连接失败或后台返回 SHALL 降级为 30 秒轮询 `GET /app/message/unread`,进入后台时 MUST 停止轮询以省电。一期 MUST NOT 声称支持离线推送,通知偏好页 SHALL 明示"App 关闭后可能收不到实时提醒"。

#### Scenario: 断线后自动降级

- **WHEN** WebSocket 连接中断超过 10 秒
- **THEN** 应用改用轮询拉取未读数,恢复连接后停止多余轮询,期间不重复提示

#### Scenario: 后台不发请求

- **WHEN** 应用进入后台
- **THEN** 轮询与心跳停止,回前台后立即补一次未读拉取

### Requirement: 通知偏好设置

`app/me/notification-pref.tsx` SHALL 按事件类型提供站内信开关,审核结果类 MUST 显示为不可关闭并说明原因;`CASE_LEAD` 的短信开关 SHALL 默认关闭并展示可能的运营商短信费用提示。

#### Scenario: 强制类开关只读

- **WHEN** 用户尝试关闭"审核结果"站内信
- **THEN** 开关为禁用态并有文字说明,不会发出关闭请求

### Requirement: 我的线索与收藏入口

"我的" SHALL 提供"我的线索"(我提交的)与"我的收藏"两个列表入口,均支持空态引导("去广场看看")。

#### Scenario: 空态引导可点击

- **WHEN** 用户从未提交线索并进入"我的线索"
- **THEN** 展示空态文案与可用的"去广场"跳转,而非空白页
