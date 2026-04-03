import { FillPriority } from "@/modules/shared/types";
import type { TaskWithState, HomeworkInput, FillCandidate } from "./types";

/**
 * 六层自动填充优先级排序（规则 8.1）
 *
 * | 优先级 | 类型                         |
 * |--------|------------------------------|
 * | 1 最高 | 截止型（日截止功课）           |
 * | 2      | 截止型（周截止任务）           |
 * | 3      | 配额型（上周结转）             |
 * | 4      | 配额型（本周正常）             |
 * | 5      | 配额型（预算已满未标完成）     |
 * | 6 最低 | 配额型（加练，已标完成）       |
 *
 * 功课永远排在配额型前面。
 */
export function buildFillCandidates(
  tasks: TaskWithState[],
  homeworks: HomeworkInput[],
  today: Date,
  weekEndDate: Date,
  alreadyScheduledToday: Set<string>,
): FillCandidate[] {
  const candidates: FillCandidate[] = [];

  // ── Layer 1: 日截止功课（今天到期） ──
  for (const hw of homeworks) {
    if (hw.status !== "pending") continue;
    if (hw.deadlineType === "daily" && isSameDay(hw.deadlineDate, today)) {
      candidates.push({
        type: "homework",
        homeworkId: hw.homeworkId,
        name: hw.title,
        priority: FillPriority.DEADLINE_DAILY,
        urgencyScore: 100, // 日截止最紧急
      });
    }
  }

  // ── Layer 2: 周截止任务（含周截止功课） ──
  // 周截止功课
  for (const hw of homeworks) {
    if (hw.status !== "pending") continue;
    if (hw.deadlineType === "weekly") {
      const daysUntilDeadline = daysBetween(today, hw.deadlineDate);
      candidates.push({
        type: "homework",
        homeworkId: hw.homeworkId,
        name: hw.title,
        priority: FillPriority.DEADLINE_WEEKLY,
        urgencyScore: Math.max(0, 100 - daysUntilDeadline * 10),
      });
    }
  }

  // 周截止型任务（deadline_weekly）
  for (const task of tasks) {
    if (!task.isActiveThisWeek || !task.isActive) continue;
    if (task.taskType !== "deadline_weekly") continue;

    const required = task.requiredSlots ?? 0;
    const remaining = Math.max(0, required - task.doneCount);
    if (remaining <= 0) continue;

    // 同日不重复（规则 8.2）
    if (alreadyScheduledToday.has(task.taskConfigId)) continue;

    const daysUntilEnd = daysBetween(today, weekEndDate);
    candidates.push({
      type: "task",
      taskConfigId: task.taskConfigId,
      name: task.name,
      priority: FillPriority.DEADLINE_WEEKLY,
      urgencyScore: Math.max(0, 100 - daysUntilEnd * 10 + remaining * 20),
    });
  }

  // ── Layer 3-6: 配额型任务 ──
  for (const task of tasks) {
    if (!task.isActiveThisWeek || !task.isActive) continue;
    if (task.taskType !== "quota_weekly") continue;

    // 同日不重复（规则 8.2）
    if (alreadyScheduledToday.has(task.taskConfigId)) continue;

    const budget = task.weeklySlotBudget ?? 0;

    // Layer 3: 上周结转
    if (task.carriedOverSlots > 0) {
      candidates.push({
        type: "task",
        taskConfigId: task.taskConfigId,
        name: task.name,
        priority: FillPriority.CARRIED_OVER,
        urgencyScore: task.carriedOverSlots * 10,
      });
      continue; // 结转优先，不重复排入正常层
    }

    // Layer 6: 已标"本周完成"（加练）
    if (task.progressStage === "completed_for_week") {
      candidates.push({
        type: "task",
        taskConfigId: task.taskConfigId,
        name: task.name,
        priority: FillPriority.QUOTA_EXTRA,
        urgencyScore: 0,
      });
      continue;
    }

    // Layer 5: 预算已满但未标完成
    if (task.doneCount >= budget) {
      candidates.push({
        type: "task",
        taskConfigId: task.taskConfigId,
        name: task.name,
        priority: FillPriority.QUOTA_BUDGET_MET,
        urgencyScore: 0,
      });
      continue;
    }

    // Layer 4: 本周正常配额
    const remaining = Math.max(0, budget - task.doneCount);
    const daysUntilEnd = daysBetween(today, weekEndDate);
    // 紧迫度 = 剩余需求 / 剩余天数
    const urgency = daysUntilEnd > 0 ? (remaining / daysUntilEnd) * 100 : 100;
    candidates.push({
      type: "task",
      taskConfigId: task.taskConfigId,
      name: task.name,
      priority: FillPriority.QUOTA_NORMAL,
      urgencyScore: urgency,
    });
  }

  // 排序：先按 priority 升序，再按 urgencyScore 降序
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.urgencyScore - a.urgencyScore;
  });

  return candidates;
}

// ── Helpers ──

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
