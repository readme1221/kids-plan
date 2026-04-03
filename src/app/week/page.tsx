export const dynamic = "force-dynamic";

import { getOrCreateActiveWeek, getActivities } from "@/server/queries/week";
import { WeekPageClient } from "./week-client";
import { computeWeekCapacity } from "@/lib/engine";
import type { TaskWithState } from "@/lib/engine/types";
import { todayUTC, getWeekDates, isSameDay } from "@/lib/time";
import { prisma } from "@/lib/db/client";

export default async function WeekPage() {
  const week = await getOrCreateActiveWeek();
  const activities = await getActivities();
  const today = todayUTC();
  const weekDates = getWeekDates(week.startDate);

  // 获取 dayPlans
  const dayPlans = await prisma.dayPlan.findMany({
    where: { weekId: week.id },
    include: { slots: true },
  });

  // 构建日期状态
  const dateStates = weekDates.map((date) => {
    const dayPlan = dayPlans.find((dp) => isSameDay(dp.date, date));
    return {
      date: date.toISOString(),
      dayOfWeek: date.getUTCDay(),
      isOpen: dayPlan?.isOpen ?? true,
      isToday: isSameDay(date, today),
    };
  });

  // 构建任务列表
  const taskStates = week.weeklyTaskStates.map((wts) => ({
    id: wts.id,
    taskConfigId: wts.taskConfigId,
    name: wts.taskConfig.name,
    taskType: wts.taskConfig.taskType,
    weeklySlotBudget: wts.taskConfig.weeklySlotBudget,
    requiredSlots: wts.taskConfig.requiredSlots,
    doneCount: wts.doneCount,
    assignedCount: wts.assignedCount,
    progressStage: wts.progressStage,
    carriedOverSlots: wts.carriedOverSlots,
    isActiveThisWeek: wts.isActiveThisWeek,
  }));

  // 计算容量
  const taskInputs: TaskWithState[] = week.weeklyTaskStates.map((wts) => ({
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

  // 计算剩余天数和槽数
  const remainingDays = dateStates.filter(
    (d) => new Date(d.date) >= today && d.isOpen,
  ).length;

  let totalRemainingSlots = 0;
  let fixedTimeSlots = 0;
  for (const dp of dayPlans) {
    if (dp.date < today || !dp.isOpen) continue;
    const config = dp.periodConfig as Record<string, { enabled: boolean; parentSlots: number }>;
    for (const p of Object.values(config)) {
      if (p.enabled) totalRemainingSlots += p.parentSlots;
    }
    fixedTimeSlots += dp.slots.filter((s) => s.sourceType === "fixed_time" || s.sourceType === "locked").length;
  }

  // 如果没有 dayPlans 数据，用默认值估算
  if (dayPlans.length === 0) {
    totalRemainingSlots = remainingDays * 11; // 3+3+3+2=11 per day
  }

  const capacity = computeWeekCapacity({
    tasks: taskInputs,
    remainingDays,
    totalRemainingSlots,
    fixedTimeSlots,
  });

  // 活动状态
  const activityStates = activities.map((a) => ({
    id: a.id,
    name: a.name,
    dayOfWeek: a.dayOfWeek,
    activeThisWeek: a.activeThisWeek,
  }));

  // 功课统计
  const homeworks = await prisma.homework.findMany({ where: { weekId: week.id } });
  const homeworkCount = {
    total: homeworks.length,
    done: homeworks.filter((h) => h.status === "done").length,
    pending: homeworks.filter((h) => h.status === "pending").length,
  };

  return (
    <WeekPageClient
      weekId={week.id}
      weekStatus={week.status}
      dateStates={dateStates}
      taskStates={taskStates}
      capacity={capacity}
      activityStates={activityStates}
      homeworkCount={homeworkCount}
    />
  );
}
