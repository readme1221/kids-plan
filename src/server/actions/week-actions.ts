"use server";

import { prisma } from "@/lib/db/client";
import { revalidatePath } from "next/cache";

/**
 * on_weekday_toggled：开/关周视图某天
 * 重算剩余天数、优先级、容量
 */
export async function toggleWeekday(params: {
  weekId: string;
  date: Date;
  isOpen: boolean;
}) {
  const { weekId, date, isOpen } = params;

  await prisma.dayPlan.upsert({
    where: { weekId_date: { weekId, date } },
    create: {
      weekId,
      date,
      isOpen,
      periodConfig: {
        morning: { enabled: true, maxSlots: 3, parentSlots: 3 },
        afternoon_early: { enabled: true, maxSlots: 3, parentSlots: 3 },
        afternoon_late: { enabled: true, maxSlots: 3, parentSlots: 3 },
        evening: { enabled: true, maxSlots: 2, parentSlots: 2 },
      },
    },
    update: { isOpen },
  });

  revalidatePath("/week");
  revalidatePath("/day");
}

/**
 * on_week_close：周末结算（规则 10）
 */
export async function settleWeek(weekId: string) {
  const week = await prisma.week.findUniqueOrThrow({
    where: { id: weekId },
    include: {
      weeklyTaskStates: { include: { taskConfig: true } },
      homeworks: true,
    },
  });

  if (week.status === "closed") {
    throw new Error("本周已结算");
  }

  // ── 处理未完成功课 ──
  const pendingHomeworks = week.homeworks.filter((h) => h.status === "pending");
  for (const hw of pendingHomeworks) {
    await prisma.homework.update({
      where: { id: hw.id },
      data: { status: "overdue" },
    });
  }

  // ── 计算下周结转 ──
  const nextMonday = new Date(week.endDate);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 1);
  const nextSunday = new Date(nextMonday);
  nextSunday.setUTCDate(nextMonday.getUTCDate() + 6);

  // 创建下周
  const nextWeek = await prisma.week.create({
    data: {
      startDate: nextMonday,
      endDate: nextSunday,
      status: "active",
    },
  });

  // 为每个任务创建下周状态
  for (const wts of week.weeklyTaskStates) {
    const task = wts.taskConfig;

    let carriedOverSlots = 0;
    if (task.taskType === "quota_weekly") {
      // 配额型结算规则（规则 10）
      if (wts.progressStage === "completed_for_week") {
        // completed_for_week → 默认不结转（规则 8.6）
        carriedOverSlots = 0;
      } else {
        const budget = task.weeklySlotBudget ?? 0;
        carriedOverSlots = Math.max(0, budget - wts.doneCount);
      }
    }

    // 判断是否活跃（重新根据活动表联动）
    let isActiveNextWeek = task.isActive;
    if (task.taskType === "quota_weekly" || task.taskType === "fixed_time") {
      // 检查关联活动
      const linkedActivity = await prisma.activity.findFirst({
        where: { linkedTaskId: task.id },
      });
      if (linkedActivity && !linkedActivity.activeThisWeek && linkedActivity.autoLinkStop) {
        isActiveNextWeek = false;
      }
    }

    await prisma.weeklyTaskState.create({
      data: {
        weekId: nextWeek.id,
        taskConfigId: task.id,
        assignedCount: 0,
        doneCount: 0,
        progressStage: "not_started",
        carriedOverSlots,
        isActiveThisWeek: isActiveNextWeek,
      },
    });
  }

  // 关闭本周
  await prisma.week.update({
    where: { id: weekId },
    data: {
      status: "closed",
      settledAt: new Date(),
    },
  });

  revalidatePath("/week");
  revalidatePath("/day");

  return { nextWeekId: nextWeek.id };
}
