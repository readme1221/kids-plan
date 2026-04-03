import type { Period } from "@/generated/prisma/client";
import type { PeriodConfig, PeriodName } from "@/modules/shared/types";
import { PERIODS } from "@/modules/shared/types";
import type {
  TaskWithState,
  HomeworkInput,
  ActivityInput,
  SlotAssignment,
  DayScheduleResult,
  ScheduleWarning,
  FillCandidate,
} from "./types";
import { computePeriodConfig, clampParentSlots } from "./activity-slots";
import { buildFillCandidates } from "./fill-priority";

/**
 * 排程引擎核心：生成单日排程
 *
 * 流程：
 * 1. 活动占槽 → 计算 periodConfig
 * 2. 固定时点占位
 * 3. 六层优先级自动填充
 * 4. 截止风险检测
 */
export function generateDaySchedule(params: {
  date: Date;
  dayOfWeek: number;
  weekEndDate: Date;
  tasks: TaskWithState[];
  homeworks: HomeworkInput[];
  activities: ActivityInput[];
  manualPins: SlotAssignment[];
  existingPeriodConfig?: PeriodConfig;
}): DayScheduleResult {
  const {
    date,
    dayOfWeek,
    weekEndDate,
    tasks,
    homeworks,
    activities,
    manualPins,
    existingPeriodConfig,
  } = params;

  const warnings: ScheduleWarning[] = [];
  const slots: SlotAssignment[] = [];

  // ── Step 1: 活动占槽 → periodConfig（规则 8.11） ──
  let periodConfig = existingPeriodConfig ?? computePeriodConfig(dayOfWeek, activities);
  const { config: clampedConfig, clamped } = clampParentSlots(periodConfig);
  if (clamped) {
    warnings.push({
      type: "slot_full",
      message: "活动新增导致槽位上限下调",
    });
  }
  periodConfig = clampedConfig;

  // 计算每个时段的剩余可用槽数
  const periodSlotCounts: Record<PeriodName, number> = {} as Record<PeriodName, number>;
  for (const period of PERIODS) {
    periodSlotCounts[period] = periodConfig[period].enabled
      ? periodConfig[period].parentSlots
      : 0;
  }

  // ── Step 2: 固定时点占位（规则 8.4） ──
  const fixedTimeTasks = tasks.filter(
    (t) =>
      t.taskType === "fixed_time" &&
      t.isActive &&
      t.fixedWeekdays.includes(dayOfWeek),
  );

  for (const task of fixedTimeTasks) {
    const period = task.fixedPeriod as PeriodName;
    if (!period) continue;

    const availableInPeriod = periodSlotCounts[period];

    if (availableInPeriod > 0) {
      // 正常占位
      const order = getNextOrder(slots, period);
      slots.push({
        period,
        order,
        sourceType: "fixed_time",
        taskConfigId: task.taskConfigId,
        isLocked: true,
      });
      periodSlotCounts[period]--;
    } else {
      // 无可容纳槽位 → 自动补 1 个锁定槽（规则 8.4）
      const order = getNextOrder(slots, period);
      slots.push({
        period,
        order,
        sourceType: "locked",
        taskConfigId: task.taskConfigId,
        isLocked: true,
      });
      // 锁定槽计入当日总槽数
      periodConfig[period] = {
        ...periodConfig[period],
        maxSlots: periodConfig[period].maxSlots + 1,
        parentSlots: periodConfig[period].parentSlots + 1,
      };
      warnings.push({
        type: "fixed_time_auto_slot",
        message: `${task.name}的时段无可用槽位，已自动补入锁定槽`,
        taskConfigId: task.taskConfigId,
      });
    }
  }

  // ── Step 3: 手动指定占位（冲突优先级第 2）──
  for (const pin of manualPins) {
    const period = pin.period as PeriodName;
    if (periodSlotCounts[period] > 0) {
      slots.push({ ...pin });
      periodSlotCounts[period]--;
    }
  }

  // ── Step 4: 收集已排入今天的任务 ID（用于同日不重复） ──
  const alreadyScheduledToday = new Set<string>();
  for (const slot of slots) {
    if (slot.taskConfigId) {
      alreadyScheduledToday.add(slot.taskConfigId);
    }
  }

  // ── Step 5: 构建六层优先级候选列表 ──
  const candidates = buildFillCandidates(
    tasks,
    homeworks,
    date,
    weekEndDate,
    alreadyScheduledToday,
  );

  // ── Step 6: 自动填充空槽 ──
  const filledTaskIds = new Set(alreadyScheduledToday);

  for (const candidate of candidates) {
    // 找一个有空位的时段
    const targetPeriod = findAvailablePeriod(periodSlotCounts);
    if (!targetPeriod) break; // 所有时段都满了

    // 同日不重复检查（规则 8.2）
    if (candidate.type === "task" && candidate.taskConfigId) {
      if (filledTaskIds.has(candidate.taskConfigId)) continue;
      filledTaskIds.add(candidate.taskConfigId);
    }

    const order = getNextOrder(slots, targetPeriod);
    slots.push({
      period: targetPeriod as Period,
      order,
      sourceType: candidate.type === "homework" ? "homework" : "auto_fill",
      taskConfigId: candidate.taskConfigId,
      homeworkId: candidate.homeworkId,
      isLocked: false,
    });
    periodSlotCounts[targetPeriod]--;
  }

  // ── Step 7: 截止风险检测（规则 8.3） ──
  for (const task of tasks) {
    if (task.taskType !== "deadline_weekly" || !task.isActive || !task.isActiveThisWeek) continue;
    const required = task.requiredSlots ?? 0;
    const remaining = Math.max(0, required - task.doneCount);
    if (remaining <= 0) continue;

    const daysLeft = daysBetween(date, weekEndDate);
    if (remaining > daysLeft) {
      warnings.push({
        type: "deadline_risk",
        message: `${task.name}剩余${remaining}次需完成，但只剩${daysLeft}天`,
        taskConfigId: task.taskConfigId,
      });
    }
  }

  // ── Step 8: 日截止功课冲突检测（规则 8.8） ──
  const dailyDeadlineHomeworks = homeworks.filter(
    (hw) =>
      hw.status === "pending" &&
      hw.deadlineType === "daily" &&
      isSameDay(hw.deadlineDate, date),
  );
  const totalSlots = Object.values(periodSlotCounts).reduce((sum, n) => sum + n, 0);
  // 检查日截止功课是否全部被排入
  for (const hw of dailyDeadlineHomeworks) {
    const isScheduled = slots.some((s) => s.homeworkId === hw.homeworkId);
    if (!isScheduled) {
      warnings.push({
        type: "daily_deadline_conflict",
        message: `今日有到期功课"${hw.title}"未能排入`,
        homeworkId: hw.homeworkId,
      });
    }
  }

  return {
    date,
    periodConfig,
    slots,
    warnings,
  };
}

/**
 * 周容量计算（规则 11）
 */
export function computeWeekCapacity(params: {
  tasks: TaskWithState[];
  remainingDays: number;
  totalRemainingSlots: number;
  fixedTimeSlots: number;
}): {
  remainingCapacity: number;
  remainingDemand: number;
  status: "normal" | "tight" | "overloaded";
} {
  const { tasks, totalRemainingSlots, fixedTimeSlots } = params;

  // 剩余容量 = 总可用槽数 - 固定时点已占
  const remainingCapacity = totalRemainingSlots - fixedTimeSlots;

  // 剩余需求
  let remainingDemand = 0;
  for (const task of tasks) {
    if (!task.isActive || !task.isActiveThisWeek) continue;

    // 第 5 层和第 6 层不计入刚性需求（规则 8.13）
    if (task.progressStage === "completed_for_week") continue;

    if (task.taskType === "deadline_weekly") {
      const required = task.requiredSlots ?? 0;
      remainingDemand += Math.max(0, required - task.doneCount);
    } else if (task.taskType === "quota_weekly") {
      const budget = task.weeklySlotBudget ?? 0;
      if (task.doneCount >= budget) continue; // 预算已满不计入
      remainingDemand += Math.max(0, budget - task.doneCount);
    }

    // carried_over 是独立附加债务
    remainingDemand += task.carriedOverSlots;
  }

  // 状态判断
  let status: "normal" | "tight" | "overloaded";
  if (remainingCapacity < remainingDemand) {
    status = "overloaded";
  } else if (remainingCapacity < remainingDemand + 2) {
    status = "tight";
  } else {
    status = "normal";
  }

  return { remainingCapacity, remainingDemand, status };
}

/**
 * 槽满提醒计算（规则 12）
 */
export function computeSlotFullWarning(params: {
  date: Date;
  tasks: TaskWithState[];
  homeworks: HomeworkInput[];
  weekEndDate: Date;
  totalAvailableSlots: number;
  fixedTimeSlotCount: number;
}): ScheduleWarning | null {
  const { date, tasks, homeworks, weekEndDate, totalAvailableSlots, fixedTimeSlotCount } = params;

  let minRequired = 0;

  // 今日到期日截止任务数
  minRequired += homeworks.filter(
    (hw) =>
      hw.status === "pending" &&
      hw.deadlineType === "daily" &&
      isSameDay(hw.deadlineDate, date),
  ).length;

  // 必须今日开始处理的周截止任务
  for (const task of tasks) {
    if (task.taskType !== "deadline_weekly" || !task.isActive || !task.isActiveThisWeek) continue;
    const required = task.requiredSlots ?? 0;
    const remaining = Math.max(0, required - task.doneCount);
    const daysLeft = daysBetween(date, weekEndDate);
    if (remaining > 0 && daysLeft <= remaining) {
      minRequired += 1; // 今天必须排一次
    }
  }

  // 固定时点占用
  minRequired += fixedTimeSlotCount;

  if (minRequired > totalAvailableSlots) {
    return {
      type: "slot_full",
      message: `当日最低必排需求(${minRequired})超过可用槽数(${totalAvailableSlots})`,
    };
  }

  return null;
}

// ── Internal Helpers ──

function getNextOrder(slots: SlotAssignment[], period: string): number {
  const periodSlots = slots.filter((s) => s.period === period);
  return periodSlots.length;
}

function findAvailablePeriod(counts: Record<PeriodName, number>): PeriodName | null {
  // 按时段顺序分配
  for (const period of PERIODS) {
    if (counts[period] > 0) return period;
  }
  return null;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86400000;
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(0, Math.floor((toUtc - fromUtc) / msPerDay));
}
