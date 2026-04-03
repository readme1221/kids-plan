"use server";

import { prisma } from "@/lib/db/client";
import { revalidatePath } from "next/cache";

/**
 * on_activity_updated：活动启停/时间变更/关联变更后
 * 重算槽位上限、任务启停、容量与排程
 * 已设槽数超限时自动下调并提示（规则 8.11）
 */
export async function updateActivity(params: {
  activityId: string;
  updates: {
    activeThisWeek?: boolean;
    startTime?: string;
    endTime?: string;
    linkedTaskId?: string | null;
  };
  weekId: string;
}) {
  const { activityId, updates, weekId } = params;

  const activity = await prisma.activity.findUniqueOrThrow({
    where: { id: activityId },
  });

  // 更新活动
  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: updates,
  });

  const warnings: string[] = [];

  // autoLinkStop 联动（规则 5.4）
  // 停课时，若 autoLinkStop = true，停排关联任务
  if (updates.activeThisWeek !== undefined && activity.linkedTaskId) {
    if (activity.autoLinkStop) {
      const shouldBeActive = updates.activeThisWeek;
      await prisma.weeklyTaskState.updateMany({
        where: { weekId, taskConfigId: activity.linkedTaskId },
        data: { isActiveThisWeek: shouldBeActive },
      });
      if (!shouldBeActive) {
        warnings.push(`${activity.name}停课，已自动停排关联任务`);
      }
    }
    // autoLinkStop = false 时（如钢琴课），停课不影响关联任务
  }

  // 重算受影响的 DayPlan 的 maxSlots
  const dayPlans = await prisma.dayPlan.findMany({
    where: { weekId },
    include: { slots: true },
  });

  const allActivities = await prisma.activity.findMany();

  for (const dayPlan of dayPlans) {
    const dayOfWeek = dayPlan.date.getUTCDay();
    if (dayOfWeek !== activity.dayOfWeek) continue;

    const periodConfig = dayPlan.periodConfig as Record<
      string,
      { enabled: boolean; maxSlots: number; parentSlots: number }
    >;

    // 重算该时段的活动占用
    const periodActivities = allActivities.filter(
      (a) => a.dayOfWeek === dayOfWeek && a.affectedPeriod === activity.affectedPeriod && a.activeThisWeek,
    );
    const defaultMax = getDefaultMax(activity.affectedPeriod);
    const newMaxSlots = Math.max(0, defaultMax - periodActivities.length);

    const period = activity.affectedPeriod;
    const currentConfig = periodConfig[period];
    if (currentConfig) {
      const newParentSlots = Math.min(currentConfig.parentSlots, newMaxSlots);
      const clamped = newParentSlots < currentConfig.parentSlots;

      periodConfig[period] = {
        ...currentConfig,
        maxSlots: newMaxSlots,
        parentSlots: newParentSlots,
      };

      await prisma.dayPlan.update({
        where: { id: dayPlan.id },
        data: { periodConfig },
      });

      if (clamped) {
        warnings.push(`${dayPlan.date.toISOString().slice(0, 10)}的${period}时段槽数已自动下调至${newParentSlots}`);

        // 删除超出的 auto_fill slots
        const periodSlots = dayPlan.slots
          .filter((s) => s.period === period)
          .sort((a, b) => b.order - a.order);

        let slotsToRemove = periodSlots.length - newParentSlots;
        for (const slot of periodSlots) {
          if (slotsToRemove <= 0) break;
          if (slot.sourceType === "auto_fill") {
            await prisma.slot.delete({ where: { id: slot.id } });
            slotsToRemove--;
          }
        }
      }
    }
  }

  revalidatePath("/day");
  revalidatePath("/week");
  return { activity: updated, warnings };
}

function getDefaultMax(period: string): number {
  const defaults: Record<string, number> = {
    morning: 3,
    afternoon_early: 3,
    afternoon_late: 3,
    evening: 2,
  };
  return defaults[period] ?? 3;
}
