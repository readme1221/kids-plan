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

  // 预先查询活动表（事务内不再查）
  const allActivities = await prisma.activity.findMany();

  const nextMonday = new Date(week.endDate);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 1);
  const nextSunday = new Date(nextMonday);
  nextSunday.setUTCDate(nextMonday.getUTCDate() + 6);

  const result = await prisma.$transaction(async (tx) => {
    // ── 处理未完成功课 ──
    const pendingHomeworks = week.homeworks.filter((h) => h.status === "pending");
    for (const hw of pendingHomeworks) {
      await tx.homework.update({
        where: { id: hw.id },
        data: { status: "overdue" },
      });
    }

    // ── 创建下周 ──
    const nextWeek = await tx.week.create({
      data: {
        startDate: nextMonday,
        endDate: nextSunday,
        status: "active",
      },
    });

    // ── 为每个任务创建下周状态 ──
    for (const wts of week.weeklyTaskStates) {
      const task = wts.taskConfig;

      let carriedOverSlots = 0;
      if (task.taskType === "quota_weekly") {
        if (wts.progressStage === "completed_for_week") {
          carriedOverSlots = 0;
        } else {
          const budget = task.weeklySlotBudget ?? 0;
          carriedOverSlots = Math.max(0, budget - wts.doneCount);
        }
      }

      let isActiveNextWeek = task.isActive;
      const linkedActivity = allActivities.find((a) => a.linkedTaskId === task.id);
      if (linkedActivity && !linkedActivity.activeThisWeek && linkedActivity.autoLinkStop) {
        isActiveNextWeek = false;
      }

      await tx.weeklyTaskState.create({
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

    // ── 关闭本周 ──
    await tx.week.update({
      where: { id: weekId },
      data: { status: "closed", settledAt: new Date() },
    });

    return { nextWeekId: nextWeek.id };
  });

  revalidatePath("/week");
  revalidatePath("/day");

  return result;
}
