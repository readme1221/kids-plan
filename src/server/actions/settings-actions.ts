"use server";

import { prisma } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import type { TaskType, Period } from "@/generated/prisma/client";

// ── TaskConfig CRUD ──

export async function createTaskConfig(params: {
  name: string;
  taskType: TaskType;
  weeklySlotBudget?: number;
  requiredSlots?: number;
  fixedWeekdays?: number[];
  fixedPeriod?: Period;
}) {
  const task = await prisma.taskConfig.create({
    data: {
      name: params.name,
      taskType: params.taskType,
      weeklySlotBudget: params.weeklySlotBudget ?? null,
      requiredSlots: params.requiredSlots ?? null,
      fixedWeekdays: params.fixedWeekdays ?? [],
      fixedPeriod: params.fixedPeriod ?? null,
      isActive: true,
    },
  });

  // 为当前活跃周创建 WeeklyTaskState
  const activeWeek = await prisma.week.findFirst({ where: { status: "active" } });
  if (activeWeek) {
    await prisma.weeklyTaskState.create({
      data: {
        weekId: activeWeek.id,
        taskConfigId: task.id,
        isActiveThisWeek: true,
      },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/week");
  return task;
}

export async function updateTaskConfig(params: {
  id: string;
  name?: string;
  weeklySlotBudget?: number;
  requiredSlots?: number;
  fixedWeekdays?: number[];
  fixedPeriod?: Period;
  isActive?: boolean;
}) {
  const { id, ...data } = params;
  const task = await prisma.taskConfig.update({
    where: { id },
    data,
  });

  revalidatePath("/settings");
  revalidatePath("/week");
  return task;
}

export async function deleteTaskConfig(id: string) {
  // 软删除：设为 inactive
  await prisma.taskConfig.update({
    where: { id },
    data: { isActive: false },
  });

  revalidatePath("/settings");
  revalidatePath("/week");
}

// ── Activity CRUD ──

export async function createActivity(params: {
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  affectedPeriod: Period;
  linkedTaskId?: string;
  autoLinkStop?: boolean;
}) {
  const activity = await prisma.activity.create({
    data: {
      name: params.name,
      dayOfWeek: params.dayOfWeek,
      startTime: params.startTime,
      endTime: params.endTime,
      affectedPeriod: params.affectedPeriod,
      linkedTaskId: params.linkedTaskId ?? null,
      activeThisWeek: true,
      autoLinkStop: params.autoLinkStop ?? true,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/week");
  return activity;
}

export async function updateActivityConfig(params: {
  id: string;
  name?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  affectedPeriod?: Period;
  linkedTaskId?: string | null;
  autoLinkStop?: boolean;
}) {
  const { id, ...data } = params;
  const activity = await prisma.activity.update({
    where: { id },
    data,
  });

  revalidatePath("/settings");
  revalidatePath("/week");
  return activity;
}

export async function deleteActivity(id: string) {
  await prisma.activity.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/week");
}
