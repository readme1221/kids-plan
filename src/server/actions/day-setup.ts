"use server";

import { prisma } from "@/lib/db/client";
import { generateDaySchedule } from "@/lib/engine";
import { computePeriodConfig } from "@/lib/engine/activity-slots";
import type { TaskWithState, HomeworkInput, ActivityInput } from "@/lib/engine/types";
import type { PeriodConfig } from "@/modules/shared/types";
import { getDayOfWeek } from "@/lib/time";
import { revalidatePath } from "next/cache";

/**
 * on_day_setup：选时段/定槽数后 → 生成当日计划，填充空槽
 */
export async function setupDay(params: {
  weekId: string;
  date: Date;
  isOpen: boolean;
  periodConfig?: PeriodConfig;
}) {
  const { weekId, date, isOpen, periodConfig: userPeriodConfig } = params;
  const dayOfWeek = getDayOfWeek(date);

  // 获取周信息
  const week = await prisma.week.findUniqueOrThrow({
    where: { id: weekId },
    include: {
      weeklyTaskStates: { include: { taskConfig: true } },
      homeworks: true,
    },
  });

  // 获取活动
  const activities = await prisma.activity.findMany();

  // 如果不学习
  if (!isOpen) {
    // 检查日截止功课（规则 8.8）
    const dailyDeadlines = week.homeworks.filter(
      (hw) =>
        hw.status === "pending" &&
        hw.deadlineType === "daily" &&
        hw.deadlineDate.getTime() === date.getTime(),
    );

    // 创建/更新 DayPlan
    const dayPlan = await prisma.dayPlan.upsert({
      where: { weekId_date: { weekId, date } },
      create: {
        weekId,
        date,
        isOpen: false,
        periodConfig: computePeriodConfig(dayOfWeek, mapActivities(activities)),
      },
      update: { isOpen: false },
    });

    // 删除已有 slots
    await prisma.slot.deleteMany({ where: { dayPlanId: dayPlan.id } });

    revalidatePath("/day");
    return {
      dayPlan,
      warnings: dailyDeadlines.length > 0
        ? [{ type: "daily_deadline_conflict" as const, message: `今日有${dailyDeadlines.length}项到期功课`, homeworks: dailyDeadlines.map(h => h.title) }]
        : [],
    };
  }

  // 计算 periodConfig
  const activityInputs = mapActivities(activities);
  let periodConfig = userPeriodConfig ?? computePeriodConfig(dayOfWeek, activityInputs);

  // 构建排程引擎输入
  const taskInputs: TaskWithState[] = week.weeklyTaskStates
    .filter((wts) => wts.taskConfig.isActive && wts.isActiveThisWeek)
    .map((wts) => ({
      taskConfigId: wts.taskConfigId,
      name: wts.taskConfig.name,
      taskType: wts.taskConfig.taskType,
      weeklySlotBudget: wts.taskConfig.weeklySlotBudget,
      requiredSlots: wts.taskConfig.requiredSlots,
      fixedWeekdays: wts.taskConfig.fixedWeekdays,
      fixedPeriod: wts.taskConfig.fixedPeriod,
      isActive: wts.taskConfig.isActive,
      assignedCount: wts.assignedCount,
      doneCount: wts.doneCount,
      progressStage: wts.progressStage,
      carriedOverSlots: wts.carriedOverSlots,
      isActiveThisWeek: wts.isActiveThisWeek,
    }));

  const homeworkInputs: HomeworkInput[] = week.homeworks
    .filter((hw) => hw.status === "pending")
    .map((hw) => ({
      homeworkId: hw.id,
      title: hw.title,
      deadlineType: hw.deadlineType,
      deadlineDate: hw.deadlineDate,
      status: hw.status,
    }));

  // 获取已有手动指定
  const existingDayPlan = await prisma.dayPlan.findUnique({
    where: { weekId_date: { weekId, date } },
    include: { slots: true },
  });
  const manualPins = (existingDayPlan?.slots ?? [])
    .filter((s) => s.sourceType === "manual_pin")
    .map((s) => ({
      period: s.period,
      order: s.order,
      sourceType: s.sourceType as "manual_pin",
      taskConfigId: s.taskConfigId ?? undefined,
      homeworkId: s.homeworkId ?? undefined,
      isLocked: false,
    }));

  // 运行排程引擎
  const result = generateDaySchedule({
    date,
    dayOfWeek,
    weekEndDate: week.endDate,
    tasks: taskInputs,
    homeworks: homeworkInputs,
    activities: activityInputs,
    manualPins,
    existingPeriodConfig: periodConfig,
  });

  // 保存 DayPlan
  const dayPlan = await prisma.dayPlan.upsert({
    where: { weekId_date: { weekId, date } },
    create: {
      weekId,
      date,
      isOpen: true,
      periodConfig: result.periodConfig as unknown as Record<string, never>,
    },
    update: {
      isOpen: true,
      periodConfig: result.periodConfig as unknown as Record<string, never>,
    },
  });

  // 删除旧 slots，写入新 slots
  await prisma.slot.deleteMany({ where: { dayPlanId: dayPlan.id } });

  if (result.slots.length > 0) {
    await prisma.slot.createMany({
      data: result.slots.map((s) => ({
        dayPlanId: dayPlan.id,
        period: s.period,
        order: s.order,
        sourceType: s.sourceType,
        taskConfigId: s.taskConfigId ?? null,
        homeworkId: s.homeworkId ?? null,
        isLocked: s.isLocked,
      })),
    });
  }

  // 更新 assignedCount（规则 8.5）
  const newlyAssignedTaskIds = new Set(
    result.slots
      .filter((s) => s.taskConfigId && s.sourceType !== "manual_pin")
      .map((s) => s.taskConfigId!),
  );
  // 对比旧 slots，找出新排入的任务
  const previouslyAssigned = new Set(
    (existingDayPlan?.slots ?? [])
      .filter((s) => s.taskConfigId)
      .map((s) => s.taskConfigId!),
  );
  for (const taskId of newlyAssignedTaskIds) {
    if (!previouslyAssigned.has(taskId)) {
      await prisma.weeklyTaskState.updateMany({
        where: { weekId, taskConfigId: taskId },
        data: { assignedCount: { increment: 1 } },
      });
    }
  }

  revalidatePath("/day");
  return { dayPlan, warnings: result.warnings };
}

function mapActivities(activities: { id: string; name: string; dayOfWeek: number; startTime: string; endTime: string; affectedPeriod: string; linkedTaskId: string | null; activeThisWeek: boolean }[]): ActivityInput[] {
  return activities.map((a) => ({
    activityId: a.id,
    name: a.name,
    dayOfWeek: a.dayOfWeek,
    startTime: a.startTime,
    endTime: a.endTime,
    affectedPeriod: a.affectedPeriod as ActivityInput["affectedPeriod"],
    linkedTaskId: a.linkedTaskId,
    activeThisWeek: a.activeThisWeek,
  }));
}
