# Claude Code 启动指令

## 第一步：读文档
1. 读 `HANDOFF.md`（技术方案与实现规范）
2. 读 `docs/law_v081.pdf`（法案，业务规则的唯一权威来源）

## 第二步：Phase 1 实现
按 HANDOFF.md Section 18 的 Phase 1 开始：
1. 初始化 Next.js 项目（TypeScript, Tailwind, shadcn/ui）
2. 配置 Prisma + Vercel Postgres
3. 建 schema（Week / TaskConfig / WeeklyTaskState / Homework / Activity / DayPlan / Slot / ExecutionLog）
4. 写 seed 脚本（默认任务表9项 + 默认活动表8项，数据见 HANDOFF.md Section 7）
5. 实现排程引擎（六层优先级 + 自动填充 + 固定时点占位）
6. 周计划页 MVP（/week）
7. 日计划页 MVP（/day）

## 关键约束
- 规则引擎放服务端，前端不猜规则
- 六层优先级顺序不可改
- 手机优先设计
- 所有重排由事件触发（见 HANDOFF.md Section 9）
