"use server";

import { prisma } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import type { SlideReason } from "@/generated/prisma/client";

/**
 * on_task_done：打勾完成
 * doneCount +1；不补排（设计原则：早完成早自由）
 */
export async function markTaskDone(params: {
  slotId: string;
  weekId: string;
  date: Date;
}) {
  const { slotId, weekId, date } = params;

  const slot = await prisma.slot.findUniqueOrThrow({
    where: { id: slotId },
  });

  // 创建执行日志
  await prisma.executionLog.create({
    data: {
      slotId,
      weekId,
      date,
      taskConfigId: slot.taskConfigId,
      homeworkId: slot.homeworkId,
      result: "done",
    },
  });

  // 更新任务计数
  if (slot.taskConfigId) {
    await prisma.weeklyTaskState.updateMany({
      where: { weekId, taskConfigId: slot.taskConfigId },
      data: { doneCount: { increment: 1 } },
    });
  }

  // 更新功课状态
  if (slot.homeworkId) {
    await prisma.homework.update({
      where: { id: slot.homeworkId },
      data: { status: "done" },
    });
  }

  revalidatePath("/day");
  revalidatePath("/week");
}

/**
 * on_task_slid：滑移
 * 移除任务，空槽重新填充
 */
export async function slideTask(params: {
  slotId: string;
  weekId: string;
  date: Date;
  reason: SlideReason;
}) {
  const { slotId, weekId, date, reason } = params;

  const slot = await prisma.slot.findUniqueOrThrow({
    where: { id: slotId },
  });

  // 创建执行日志
  await prisma.executionLog.create({
    data: {
      slotId,
      weekId,
      date,
      taskConfigId: slot.taskConfigId,
      homeworkId: slot.homeworkId,
      result: "slid",
      slideReason: reason,
    },
  });

  // 删除该 slot（空出位置）
  await prisma.slot.delete({ where: { id: slotId } });

  // doneCount 不变（滑移不计完成）
  // assignedCount 不减（已排入过）

  revalidatePath("/day");
  revalidatePath("/week");
}

/**
 * on_manual_pin：手动指定任务到槽位
 */
export async function manualPinTask(params: {
  dayPlanId: string;
  period: string;
  taskConfigId?: string;
  homeworkId?: string;
  weekId: string;
}) {
  const { dayPlanId, period, taskConfigId, homeworkId, weekId } = params;

  // 检查该时段是否还有空位
  const dayPlan = await prisma.dayPlan.findUniqueOrThrow({
    where: { id: dayPlanId },
    include: { slots: true },
  });
  const periodConfig = dayPlan.periodConfig as Record<string, { enabled: boolean; parentSlots: number }>;
  const periodSlots = dayPlan.slots.filter((s) => s.period === period);
  const maxSlots = periodConfig[period]?.parentSlots ?? 0;
  if (periodSlots.length >= maxSlots) {
    throw new Error("该时段已满");
  }

  const nextOrder = periodSlots.length > 0
    ? Math.max(...periodSlots.map((s) => s.order)) + 1
    : 0;

  // 创建手动指定 slot
  const slot = await prisma.slot.create({
    data: {
      dayPlanId,
      period: period as never,
      order: nextOrder,
      sourceType: "manual_pin",
      taskConfigId: taskConfigId ?? null,
      homeworkId: homeworkId ?? null,
      isLocked: false,
    },
  });

  // assignedCount +1
  if (taskConfigId) {
    await prisma.weeklyTaskState.updateMany({
      where: { weekId, taskConfigId },
      data: { assignedCount: { increment: 1 } },
    });
  }

  revalidatePath("/day");
  return slot;
}

/**
 * 移除手动指定的任务
 */
export async function removeManualPin(params: {
  slotId: string;
  weekId: string;
}) {
  const { slotId, weekId } = params;

  const slot = await prisma.slot.findUniqueOrThrow({
    where: { id: slotId },
  });

  if (slot.sourceType !== "manual_pin") {
    throw new Error("只能移除手动指定的任务");
  }

  // assignedCount -1（规则 8.5：家长手动移出且当日未执行）
  if (slot.taskConfigId) {
    await prisma.weeklyTaskState.updateMany({
      where: { weekId, taskConfigId: slot.taskConfigId },
      data: { assignedCount: { decrement: 1 } },
    });
  }

  await prisma.slot.delete({ where: { id: slotId } });

  revalidatePath("/day");
}

/**
 * on_progress_updated：更新进度阶段
 */
export async function updateProgressStage(params: {
  weekId: string;
  taskConfigId: string;
  progressStage: "not_started" | "in_progress" | "mostly_done" | "completed_for_week";
}) {
  const { weekId, taskConfigId, progressStage } = params;

  await prisma.weeklyTaskState.updateMany({
    where: { weekId, taskConfigId },
    data: { progressStage },
  });

  revalidatePath("/week");
  revalidatePath("/day");
}
