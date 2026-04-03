# HANDOFF.md
## 项目：孩子每日学习计划 Dashboard
### 交接对象：Code
### 状态：技术方案已冻结，可进入实现
### 法案版本：V0.8.1（正文+附录A-F）

---

## 1. 目标

本项目的核心场景不是桌面重后台，而是：

- 家长每天拿手机打开 Dashboard
- 点几下完成：选时段、定槽数、输入功课、手动指定任务
- 系统自动填充剩余空槽
- 孩子执行后，家长勾完成或滑移
- 每周自动做结算、周报、容量提醒

首版目标是：**先把"每天可顺手操作"做顺，不追求复杂优化。**

---

## 2. 技术栈（已冻结）

- Framework: **Next.js**
- Language: **TypeScript**
- UI: **Tailwind CSS + shadcn/ui**
- Drag & Drop: **dnd-kit**
- ORM: **Prisma**
- Database: **Vercel Postgres**
- Hosting: **Vercel**
- Mobile UX: **Responsive Web + PWA**

### 明确排除
- 不用 SQLite
- 不做本地-only 方案
- 不先做原生 App
- 不做低代码面板

---

## 3. 实现原则

1. **手机优先**
   - 默认先做 iPhone 竖屏体验
   - 桌面端只是扩展，不是主战场

2. **规则先行**
   - 排程规则以法案为准
   - 前端不得擅自改规则含义

3. **默认保守**
   - 系统自动填充遵守规则
   - 例外交给家长手动覆盖

4. **事件驱动重排**
   - 所有重排都由明确事件触发
   - 不做隐式、难解释的自动行为

5. **MVP 先通，再精**
   - 先保证可用、稳定、可解释
   - 后续再优化交互细节和统计分析

---

## 4. MVP 范围

### 必做
1. 周计划管理
2. 日计划生成
3. 槽位系统
4. 功课输入
5. 手动指定任务
6. 自动填充空槽
7. 完成 / 滑移
8. 周结算
9. 周报告
10. 周容量仪表盘
11. 课外活动占槽与联动
12. PWA 安装与手机端优化

### 暂不做
1. 多用户体系
2. 权限系统
3. 推送通知
4. AI 自动拆任务
5. 复杂统计图表
6. 离线优先同步冲突处理
7. 原生 App 封装

---

## 5. 核心业务模块

按业务域拆模块，不按页面拆。

### 5.1 weekly-plan
负责：
- 周实体管理（Week）
- 周任务状态（WeeklyTaskState）
- budget / progress / carried_over
- 周结算
- 周视图开关
- 周容量指标

### 5.2 daily-schedule
负责：
- 当日时段与槽位
- 活动占槽计算 → 最大可用槽数
- 家长设槽（不超过上限）
- 自动填充
- 手动指定
- 重排

### 5.3 tasks
负责：
- 四类任务配置（TaskConfig）
- `requiredSlots`（周截止型）
- 固定时点配置

### 5.4 activities
负责：
- 课外活动表
- 占槽
- `linkedTaskId`
- `autoLinkStop`
- 活动更新触发重排

### 5.5 reports
负责：
- 周报
- 滑移原因统计
- 完成率
- 预警

### 5.6 shared
负责：
- 枚举
- 时间工具
- 校验器
- 日志结构
- 公共类型

---

## 6. 目录建议

```text
app/
  week/
  day/
  reports/
  settings/
  api/

src/
  modules/
    weekly-plan/
    daily-schedule/
    tasks/
    activities/
    reports/
    shared/
  components/
    ui/
    schedule/
    week/
    report/
  lib/
    db/
    engine/        # 排程引擎、容量计算、填充算法
    time/
    logger/
    validators/
  server/
    actions/
    queries/

prisma/
  schema.prisma

public/
  manifest.json
  icons/
```

---

## 7. 数据模型（MVP）

### 设计原则

Task 的配置（名字、类型、budget）和周状态（本周 assigned/done/progress）必须分离。否则周结算时原地覆盖，历史丢失。

### 7.1 Week
管理周边界和周级别状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| startDate | date | 本周一日期 |
| endDate | date | 本周日日期 |
| status | enum | `active` / `closed` |
| settledAt | datetime? | 结算时间 |

### 7.2 TaskConfig
不变的任务配置。周结算不动这张表。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | task_id，外键基准 |
| name | string | 显示名（如"钢琴练习"） |
| taskType | enum | `deadline_daily` / `deadline_weekly` / `quota_weekly` / `fixed_time` |
| weeklySlotBudget | int? | 配额型每周预算 |
| requiredSlots | int? | 周截止型所需 slot 数 |
| fixedWeekdays | int[]? | 固定时点型：星期几（0=周日） |
| fixedPeriod | enum? | 固定时点型：对应时段 |
| isActive | boolean | 是否启用 |

### 7.3 WeeklyTaskState
每周每个任务一行。周结算时新建下周行，旧行保留做历史。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| weekId | string | FK → Week |
| taskConfigId | string | FK → TaskConfig |
| assignedCount | int | 本周被排入几次（含滑移） |
| doneCount | int | 本周真正完成几次 |
| progressStage | enum | `not_started` / `in_progress` / `mostly_done` / `completed_for_week` |
| carriedOverSlots | int | 从上周结转来的 slot 数 |
| isActiveThisWeek | boolean | 本周是否参与排程（活动联动可关） |

### 7.4 Homework
临时功课，每条独立。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| title | string | 功课名 |
| deadlineType | enum | `daily` / `weekly` |
| deadlineDate | date | 截止日 |
| status | enum | `pending` / `done` / `overdue` |
| weekId | string | FK → Week |

### 7.5 Activity
课外活动表，可配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| name | string | 活动名（如"钢琴课"） |
| dayOfWeek | int | 星期几 |
| startTime | string | 开始时间（HH:mm） |
| endTime | string | 结束时间（HH:mm） |
| affectedPeriod | enum | `morning` / `afternoon_early` / `afternoon_late` / `evening` |
| linkedTaskId | string? | FK → TaskConfig（可为空） |
| activeThisWeek | boolean | 本周是否正常进行 |
| autoLinkStop | boolean | 停课时是否自动停排关联任务（默认 true；钢琴课设 false） |

### 7.6 DayPlan
每天一行。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| weekId | string | FK → Week |
| date | date | 日期 |
| isOpen | boolean | 当天是否学习 |
| periodConfig | json | 见下方结构 |

**periodConfig 结构（必须严格遵守）：**

```typescript
type PeriodConfig = {
  morning:          { enabled: boolean; maxSlots: number; parentSlots: number };
  afternoon_early:  { enabled: boolean; maxSlots: number; parentSlots: number };
  afternoon_late:   { enabled: boolean; maxSlots: number; parentSlots: number };
  evening:          { enabled: boolean; maxSlots: number; parentSlots: number };
};
```

- `maxSlots`：活动占槽后的上限（系统计算，家长不可超过）
- `parentSlots`：家长实际设定的槽数（≤ maxSlots）
- 当日可用总槽数 = Σ parentSlots（所有 enabled 时段）

### 7.7 Slot
每个槽位一行。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| dayPlanId | string | FK → DayPlan |
| period | enum | 所属时段 |
| order | int | 时段内顺序 |
| sourceType | enum | `fixed_time` / `manual_pin` / `homework` / `auto_fill` / `locked` |
| taskConfigId | string? | FK → TaskConfig |
| homeworkId | string? | FK → Homework |
| isLocked | boolean | 是否锁定（固定时点自动补入的） |

### 7.8 ExecutionLog
每次执行一行。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| slotId | string | FK → Slot |
| weekId | string | FK → Week |
| date | date | 日期 |
| taskConfigId | string? | FK |
| homeworkId | string? | FK |
| result | enum | `done` / `slid` |
| slideReason | enum? | `time_insufficient` / `child_gave_up` / `parent_manual` / `fixed_missed` / `deadline_expired` |

---

## 8. 关键规则（必须严格实现）

### 8.1 六层自动填充优先级

| 优先级 | 类型 | 说明 |
|--------|------|------|
| 1 最高 | 截止型（日截止） | 今天到期的功课 |
| 2 | 截止型（周截止） | 本周内到期（如华文听写） |
| 3 | 配额型（上周结转） | carried_over 任务 |
| 4 | 配额型（本周正常） | 未完成，按进度×剩余天数排序 |
| 5 | 配额型（预算已满未标完成） | doneCount ≥ budget 但家长未标"本周完成" |
| 6 最低 | 配额型（加练） | 家长已标"本周完成" |

**功课永远排在配额型前面。**

### 8.2 同日不重复
- 自动填充时：同任务同日最多一次
- 家长手动指定：可覆盖

### 8.3 截止风险规则
若周截止任务 `remaining_required_slots > remaining_open_days`，判定为截止风险：
- 必须提示家长手动处理
- 不得自动突破"同日不重复"

**`remaining_open_days` 定义：** 从今日起至本周末，所有已开启且当日仍有至少 1 个可用于该任务的非固定槽位的天数。

### 8.4 fixed-time 规则
- 不参与排序，直接占位
- 若对应时段 0 槽或无可容纳槽位：
  - 自动补 1 个锁定槽
  - 提示家长
  - 锁定槽计入当日总槽数与周容量
- 被覆盖时必须弹提示确认，记 missed

### 8.5 done / assigned 规则

| 场景 | 计数动作 |
|------|---------|
| 任务首次排入槽位 | assignedCount +1 |
| 同天内仅在槽位间移动 | 不重复加 |
| 打勾完成 | doneCount +1 |
| 滑移 | doneCount 不变 |
| 家长手动移出（当日未执行） | assignedCount -1 |

**停止自动排程判断：始终以 doneCount 为准，不以 assignedCount 为准。**

### 8.6 completed_for_week 规则
- 家长标记完成后：
  - 降为第 6 层（加练）
  - `remainingDemand = 0`
  - 周结算默认 `carriedOverSlots = 0`
  - 除非家长手动指定继续结转

### 8.7 carried_over 规则
- 是独立附加债务，不并入新周 budget
- 默认不算"今日最低必排"
- 只有家长钉为今天必须处理时才算

### 8.8 日截止冲突规则
当天有日截止功课时，若家长选"不学"或当天无可用槽位，系统必须提示"今日有到期功课"并要求确认：
- 仍跳过并接受过期
- 或临时加入槽位处理

**不得静默跳过日截止任务。**

### 8.9 满槽新增功课规则
新增功课进入已满日计划时：
1. 先尝试替换自动填充任务
2. 若无自动填充任务，提示家长手动处理
3. 不得静默覆盖手动指定和固定时点任务

### 8.10 连续滑移预警
连续 2 天非功课任务完成数为 0 时，系统预警。提醒，不强制。

### 8.11 活动占槽先后顺序
活动占槽先于家长手动定槽。系统先按活动表计算各时段 `maxSlots`，家长输入的 `parentSlots` 不得超过 `maxSlots`。若活动临时新增导致已设槽数超限，系统自动下调至上限并提示。

### 8.12 冲突优先级

| 优先级 | 规则 | 说明 |
|--------|------|------|
| 1 最高 | 固定时点型 | 不可被静默覆盖；家长强行改时提示确认，记 missed |
| 2 | 家长手动指定 | 优先于功课和自动填充 |
| 3 | 功课 | 优先于自动填充 |
| 4 | 自动填充 | 按六层优先级 |

家长手动指定到已占槽位时：提示"替换 / 交换 / 取消"。被替换的非固定任务回到待排池并立即重排。

### 8.13 第 5 层与第 6 层不计入刚性需求
"预算已满未标完成"和"加练"只影响自动填充排序，不影响超载判断。

---

## 9. 事件触发（必须实现）

| 事件 | 触发时机 | 系统动作 |
|------|---------|---------|
| on_day_setup | 选时段/定槽数后 | 生成当日计划，填充空槽 |
| on_homework_added | 输入功课后 | 功课占槽；满槽时先替换自动填充，无可替换则提示家长；不静默覆盖手动和固定时点 |
| on_manual_pin | 指定/移除任务后 | 重算剩余槽填充 |
| on_task_slid | 滑移后 | 移除任务，空槽重新填充 |
| on_task_done | 打勾完成 | doneCount +1；**不补排（设计原则：早完成早自由）** |
| on_weekday_toggled | 开/关周视图某天 | 重算剩余天数、优先级、容量 |
| on_progress_updated | 更新进度后 | "本周完成"→降优先级；重算后续排程 |
| on_week_close | 周末结算 | 执行周结算规则；生成周报；初始化下周 |
| on_activity_updated | 活动启停/时间变更/关联变更后 | 重算槽位上限、任务启停、容量与排程；已设槽数超限时自动下调并提示 |

**不在此表中的操作不触发重排。**

---

## 10. 周结算规则

### 配额型任务

| 字段 | 结算动作 |
|------|---------|
| assignedCount | 清零 |
| doneCount | 清零 |
| progressStage | 默认重置为 `not_started`，除非家长手动保留 |
| carriedOverSlots | 若 progressStage = completed_for_week → 默认 0；否则 = min(配置上限, max(0, budget - doneCount))；家长可调 |
| isActiveThisWeek | 重新根据活动表联动 |

### 截止型任务
- 日截止：已归档，不跨周
- 周截止：未完成记 overdue，新周重新生成任务，不延续旧任务本体

### 固定时点型
- missedCount 保留历史累计，不清零
- 周报另算本周 missed 数

### 华文听写建模
截止型（周截止），requiredSlots = 2。达到 requiredSlots 或家长标记完成 → 完成；未达成 → 周末记 overdue。

---

## 11. 周容量公式

### 剩余容量
```
remaining_capacity = 本周剩余开启天的总可用槽数 − 未来固定时点已占槽数
```

### 剩余需求
```
remaining_demand = 未完成周截止任务所需最少槽数
                 + Σ max(0, budget − doneCount)  // 仅 progressStage ≠ completed_for_week 的配额任务
                 + carried_over_slots
```

### 状态判断

| 状态 | 条件 | 建议 |
|------|------|------|
| 正常 | capacity ≥ demand | 无需干预 |
| 紧张 | capacity < demand + 2 | 提示关注 |
| 超载 | capacity < demand | 建议减任务或加天数 |

### 约束
- 学校功课不纳入周容量预测（未来未知）
- 第 5 层和第 6 层不计入刚性需求
- carried_over 是独立附加债务，不并入新周 budget
- 所有公式单位统一为 slot

---

## 12. 槽满提醒精确定义

**触发条件：当日最低必排需求 > 当日可用槽数**

当日最低必排需求 =
- 今日到期日截止任务数
- \+ 必须今日开始处理的周截止任务数（剩余天数 ≤ 剩余 requiredSlots）
- \+ 固定时点占用槽数

**carried_over 默认不算"今日最低必排"，除非家长手动钉为今天必须处理。**

配额型和加练不计入。

---

## 13. 页面建议

### 13.1 `/week`
手机端重点页面：
- 本周任务总览（每项显示 doneCount/budget + progressStage）
- 周视图开关（7 天）
- carried_over 显示
- 容量状态：正常 / 紧张 / 超载
- 活动状态（哪些正常/停课）
- 周结算入口

### 13.2 `/day`
核心操作页：
- 今日是否学习（有日截止功课时必须提示）
- 各时段：maxSlots（灰显）/ parentSlots（可编辑）
- 固定时点占位（锁定显示）
- 输入功课
- 手动指定任务
- 自动填充结果
- 勾完成 / 滑移（滑移时选原因）

### 13.3 `/reports`
- 周报
- 完成率（分三栏：功课/配额/钢琴练习）
- 滑移原因统计
- missed 统计
- 预警记录

### 13.4 `/settings`
- 任务配置（TaskConfig）
- 活动表（Activity）
- 阈值配置
- PWA 安装提示

---

## 14. 手机端交互要求

### 必须做到
- 单手可操作
- 大按钮
- 少弹窗
- 卡片式布局
- 底部操作区明显
- 关键按钮固定在可触达区域

### 高频操作前置
1. 勾完成
2. 滑移
3. 输入功课
4. 手动指定
5. 改槽数

### 拖拽要求
- 拖拽只用于"指定 / 换槽 / 交换"
- 自动填充逻辑不在前端硬编码
- 前端拖拽后调用统一 action，让服务端返回新排程结果

---

## 15. 服务端职责

规则引擎放服务端，不放前端。

### 服务端负责
- 任务分类
- 自动填充（六层优先级）
- 截止风险判断
- 周容量计算
- 槽满提醒计算
- 活动占槽 → maxSlots 计算
- 周结算
- 预警生成

### 前端负责
- 展示
- 发起操作（通过 server action）
- 接收返回的新计划
- 不自己"猜"规则

---

## 16. PWA 要求

必须支持：
- `manifest.json`
- iPhone 主屏幕添加
- 基础图标
- standalone 显示模式
- 基础离线壳（页面壳可打开）

首版不强求完整离线数据编辑，但要先把安装能力做出来。

---

## 17. 数据库建议

### MVP
- Vercel Postgres
- Prisma schema 从 Day 1 就按 Postgres 写

### 不建议
- 先 SQLite 再迁移
- 前端本地存储做主存储
- 规则散落在组件里

---

## 18. 开发顺序

### Phase 1：数据与核心排程
- Prisma schema（Week / TaskConfig / WeeklyTaskState / Homework / Activity / DayPlan / Slot / ExecutionLog）
- 基础 seed（默认任务表 + 默认活动表）
- 排程引擎（六层优先级 + 自动填充 + 固定时点占位）
- 周计划页 MVP
- 日计划页 MVP

### Phase 2：交互与联动
- 手动指定 / 替换 / 交换
- 完成 / 滑移（含原因）
- 满槽新增功课替换逻辑
- 课外活动联动
- 容量仪表盘
- 截止风险提醒
- 连续滑移预警

### Phase 3：结算与发布
- 周结算
- 周报
- PWA
- 细节优化

---

## 19. 不可擅自更改的规则

Code 不得自行改动：

- 六层优先级语义与顺序
- fixed-time 自动补锁定槽
- `doneCount` 作为预算判断基准
- `completed_for_week` 置零债务
- carried_over 不并入 budget
- on_task_done 不补排
- 自动填充同日不重复
- 日截止不得静默跳过
- 满槽新增功课先替换自动填充
- 活动占槽先于家长定槽
- 例外交由家长手动覆盖

**如需调整，必须先改法案，再改代码。**

---

## 20. 交付标准

MVP 完成标准：

1. 手机上能顺手完成每日操作
2. 规则执行结果可解释
3. 不出现静默覆盖
4. 周结算正确（WeeklyTaskState 新周新行，历史可查）
5. 周报可读（三栏：功课/配额/钢琴练习）
6. 活动启停会正确联动（含 autoLinkStop 例外）
7. PWA 可添加到主屏幕
8. 容量仪表盘正确显示正常/紧张/超载

---

## 21. 一句话交接

这是一个 **手机优先、规则驱动、家长覆盖自动系统例外** 的学习计划 Dashboard。
Code 的任务不是发明新规则，而是把已经冻结的规则，稳定地做成一个每天能点几下就用完的系统。
