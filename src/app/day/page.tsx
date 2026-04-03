export const dynamic = "force-dynamic";

import { getOrCreateActiveWeek, getActivities } from "@/server/queries/week";
import { getDayPlan, getDayExecutionLogs, checkConsecutiveSlides } from "@/server/queries/day";
import { DayPageClient } from "./day-client";
import { todayUTC, formatDate, getDayOfWeek } from "@/lib/time";
import { computePeriodConfig } from "@/lib/engine/activity-slots";
import type { ActivityInput } from "@/lib/engine/types";
import type { PeriodConfig } from "@/modules/shared/types";
import { prisma } from "@/lib/db/client";

export default async function DayPage() {
  const week = await getOrCreateActiveWeek();
  const today = todayUTC();
  const dayOfWeek = getDayOfWeek(today);

  // 获取今日计划
  const dayPlan = await getDayPlan(week.id, today);

  // 获取活动
  const activities = await getActivities();
  const activityInputs: ActivityInput[] = activities.map((a) => ({
    activityId: a.id,
    name: a.name,
    dayOfWeek: a.dayOfWeek,
    startTime: a.startTime,
    endTime: a.endTime,
    affectedPeriod: a.affectedPeriod as ActivityInput["affectedPeriod"],
    linkedTaskId: a.linkedTaskId,
    activeThisWeek: a.activeThisWeek,
  }));

  // 计算默认 periodConfig
  const defaultPeriodConfig = computePeriodConfig(dayOfWeek, activityInputs);
  const periodConfig = (dayPlan?.periodConfig as PeriodConfig) ?? defaultPeriodConfig;

  // 获取执行日志
  const executionLogs = await getDayExecutionLogs(week.id, today);
  const completedSlotIds = new Set(
    executionLogs.filter((l) => l.result === "done").map((l) => l.slotId),
  );

  // 连续滑移预警
  const consecutiveSlideWarning = await checkConsecutiveSlides(week.id, today);

  // 获取可手动指定的任务列表
  const taskConfigs = await prisma.taskConfig.findMany({
    where: { isActive: true },
    include: {
      weeklyTaskStates: {
        where: { weekId: week.id },
      },
    },
  });

  const availableTasks = taskConfigs
    .filter((t) => t.taskType !== "fixed_time")
    .map((t) => ({
      id: t.id,
      name: t.name,
      taskType: t.taskType,
    }));

  // 获取待处理功课
  const pendingHomeworks = await prisma.homework.findMany({
    where: { weekId: week.id, status: "pending" },
    orderBy: { deadlineDate: "asc" },
  });

  // 构建 slots 数据
  const slots = (dayPlan?.slots ?? []).map((s) => ({
    id: s.id,
    period: s.period,
    order: s.order,
    sourceType: s.sourceType,
    taskConfigId: s.taskConfigId,
    homeworkId: s.homeworkId,
    isLocked: s.isLocked,
    name: s.taskConfig?.name ?? s.homework?.title ?? "未知",
    isCompleted: completedSlotIds.has(s.id),
  }));

  // 今日活动
  const todayActivities = activities
    .filter((a) => a.dayOfWeek === dayOfWeek && a.activeThisWeek)
    .map((a) => ({ name: a.name, startTime: a.startTime, endTime: a.endTime }));

  return (
    <DayPageClient
      weekId={week.id}
      date={formatDate(today)}
      dayOfWeek={dayOfWeek}
      isOpen={dayPlan?.isOpen ?? true}
      dayPlanId={dayPlan?.id ?? null}
      periodConfig={periodConfig}
      slots={slots}
      availableTasks={availableTasks}
      pendingHomeworks={pendingHomeworks.map((h) => ({
        id: h.id,
        title: h.title,
        deadlineType: h.deadlineType,
        deadlineDate: formatDate(h.deadlineDate),
      }))}
      todayActivities={todayActivities}
      consecutiveSlideWarning={consecutiveSlideWarning}
    />
  );
}
