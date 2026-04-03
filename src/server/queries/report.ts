import { prisma } from "@/lib/db/client";
import type { SlideReason } from "@/generated/prisma/client";

export type WeekReportData = {
  weekId: string;
  startDate: string;
  endDate: string;
  status: string;
  // 三栏统计
  homeworkStats: {
    total: number;
    done: number;
    overdue: number;
  };
  quotaStats: {
    tasks: {
      name: string;
      budget: number;
      doneCount: number;
      carriedOverSlots: number;
      progressStage: string;
    }[];
  };
  fixedTimeStats: {
    tasks: {
      name: string;
      totalScheduled: number;
      doneCount: number;
      missedCount: number;
    }[];
  };
  // 滑移原因统计
  slideReasons: Record<string, number>;
  // 完成率
  overallCompletionRate: number;
  // 预警记录
  warnings: string[];
};

/** 生成周报数据 */
export async function getWeekReport(weekId: string): Promise<WeekReportData> {
  const week = await prisma.week.findUniqueOrThrow({
    where: { id: weekId },
    include: {
      weeklyTaskStates: { include: { taskConfig: true } },
      homeworks: true,
    },
  });

  // 执行日志
  const logs = await prisma.executionLog.findMany({
    where: { weekId },
    include: { taskConfig: true, homework: true },
  });

  // ── 功课统计 ──
  const homeworkStats = {
    total: week.homeworks.length,
    done: week.homeworks.filter((h) => h.status === "done").length,
    overdue: week.homeworks.filter((h) => h.status === "overdue").length,
  };

  // ── 配额型统计 ──
  const quotaStates = week.weeklyTaskStates.filter(
    (wts) => wts.taskConfig.taskType === "quota_weekly",
  );
  const quotaStats = {
    tasks: quotaStates.map((wts) => ({
      name: wts.taskConfig.name,
      budget: wts.taskConfig.weeklySlotBudget ?? 0,
      doneCount: wts.doneCount,
      carriedOverSlots: wts.carriedOverSlots,
      progressStage: wts.progressStage,
    })),
  };

  // ── 固定时点统计 ──
  const fixedStates = week.weeklyTaskStates.filter(
    (wts) => wts.taskConfig.taskType === "fixed_time",
  );
  const fixedTimeStats = {
    tasks: fixedStates.map((wts) => {
      const taskLogs = logs.filter((l) => l.taskConfigId === wts.taskConfigId);
      const doneCount = taskLogs.filter((l) => l.result === "done").length;
      const missedCount = taskLogs.filter(
        (l) => l.result === "slid" && l.slideReason === "fixed_missed",
      ).length;
      return {
        name: wts.taskConfig.name,
        totalScheduled: wts.assignedCount,
        doneCount,
        missedCount,
      };
    }),
  };

  // ── 滑移原因统计 ──
  const slideReasons: Record<string, number> = {};
  const slidLogs = logs.filter((l) => l.result === "slid" && l.slideReason);
  for (const log of slidLogs) {
    const reason = log.slideReason as SlideReason;
    slideReasons[reason] = (slideReasons[reason] ?? 0) + 1;
  }

  // ── 完成率 ──
  const totalLogs = logs.length;
  const doneLogs = logs.filter((l) => l.result === "done").length;
  const overallCompletionRate = totalLogs > 0 ? Math.round((doneLogs / totalLogs) * 100) : 0;

  // ── 预警记录 ──
  const warnings: string[] = [];

  // 检查截止型任务
  const deadlineStates = week.weeklyTaskStates.filter(
    (wts) => wts.taskConfig.taskType === "deadline_weekly",
  );
  for (const wts of deadlineStates) {
    const required = wts.taskConfig.requiredSlots ?? 0;
    if (wts.doneCount < required) {
      warnings.push(`${wts.taskConfig.name}未达标：完成${wts.doneCount}/${required}`);
    }
  }

  // 检查配额型严重不足
  for (const wts of quotaStates) {
    const budget = wts.taskConfig.weeklySlotBudget ?? 0;
    if (budget > 0 && wts.doneCount / budget < 0.3) {
      warnings.push(`${wts.taskConfig.name}完成率过低：${wts.doneCount}/${budget}`);
    }
  }

  return {
    weekId: week.id,
    startDate: week.startDate.toISOString().slice(0, 10),
    endDate: week.endDate.toISOString().slice(0, 10),
    status: week.status,
    homeworkStats,
    quotaStats,
    fixedTimeStats,
    slideReasons,
    overallCompletionRate,
    warnings,
  };
}

/** 获取可选周列表 */
export async function getWeekList() {
  return prisma.week.findMany({
    orderBy: { startDate: "desc" },
    take: 10,
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });
}
