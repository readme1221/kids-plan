"use server";

import { prisma } from "@/lib/db/client";
import { revalidatePath } from "next/cache";

/**
 * on_homework_added：输入功课后
 * 功课占槽；满槽时先替换自动填充，无可替换则提示家长
 * 不静默覆盖手动和固定时点（规则 8.9）
 */
export async function addHomework(params: {
  weekId: string;
  title: string;
  deadlineType: "daily" | "weekly";
  deadlineDate: Date;
  dayPlanId?: string; // 可选：直接排入当天
}) {
  const { weekId, title, deadlineType, deadlineDate, dayPlanId } = params;

  // 创建功课
  const homework = await prisma.homework.create({
    data: {
      weekId,
      title,
      deadlineType,
      deadlineDate,
    },
  });

  let warning: string | null = null;

  // 如果指定了 dayPlanId，尝试排入当天
  if (dayPlanId) {
    const dayPlan = await prisma.dayPlan.findUniqueOrThrow({
      where: { id: dayPlanId },
      include: { slots: { orderBy: [{ period: "asc" }, { order: "asc" }] } },
    });

    const periodConfig = dayPlan.periodConfig as Record<string, { enabled: boolean; parentSlots: number }>;

    // 计算当日总可用槽数
    let totalSlots = 0;
    for (const p of Object.values(periodConfig)) {
      if (p.enabled) totalSlots += p.parentSlots;
    }

    if (dayPlan.slots.length < totalSlots) {
      // 有空位，直接排入
      const period = findPeriodWithSpace(dayPlan.slots, periodConfig);
      if (period) {
        const order = dayPlan.slots.filter((s) => s.period === period).length;
        await prisma.slot.create({
          data: {
            dayPlanId,
            period: period as never,
            order,
            sourceType: "homework",
            homeworkId: homework.id,
            isLocked: false,
          },
        });
      }
    } else {
      // 满槽：先尝试替换自动填充（规则 8.9）
      const autoFillSlot = dayPlan.slots.find((s) => s.sourceType === "auto_fill");
      if (autoFillSlot) {
        await prisma.slot.update({
          where: { id: autoFillSlot.id },
          data: {
            sourceType: "homework",
            homeworkId: homework.id,
            taskConfigId: null,
          },
        });

        // 被替换的任务 assignedCount -1
        if (autoFillSlot.taskConfigId) {
          await prisma.weeklyTaskState.updateMany({
            where: { weekId, taskConfigId: autoFillSlot.taskConfigId },
            data: { assignedCount: { decrement: 1 } },
          });
        }
      } else {
        // 无自动填充可替换
        warning = "所有槽位已满且无自动填充任务可替换，请手动调整";
      }
    }
  }

  revalidatePath("/day");
  revalidatePath("/week");
  return { homework, warning };
}

function findPeriodWithSpace(
  slots: { period: string }[],
  periodConfig: Record<string, { enabled: boolean; parentSlots: number }>,
): string | null {
  const periods = ["morning", "afternoon_early", "afternoon_late", "evening"];
  for (const period of periods) {
    const config = periodConfig[period];
    if (!config?.enabled) continue;
    const used = slots.filter((s) => s.period === period).length;
    if (used < config.parentSlots) return period;
  }
  return null;
}
