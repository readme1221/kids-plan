import { prisma } from "@/lib/db/client";
import { todayUTC, getMonday, getSunday } from "@/lib/time";

/** 获取当前活跃周，不存在则创建 */
export async function getOrCreateActiveWeek() {
  const today = todayUTC();
  const monday = getMonday(today);
  const sunday = getSunday(today);

  let week = await prisma.week.findFirst({
    where: { status: "active" },
    include: {
      weeklyTaskStates: {
        include: { taskConfig: true },
      },
    },
    orderBy: { startDate: "desc" },
  });

  if (!week || week.startDate.getTime() !== monday.getTime()) {
    // 创建新周
    week = await prisma.week.create({
      data: {
        startDate: monday,
        endDate: sunday,
        status: "active",
      },
      include: {
        weeklyTaskStates: {
          include: { taskConfig: true },
        },
      },
    });

    // 为所有活跃任务创建 WeeklyTaskState
    const activeTasks = await prisma.taskConfig.findMany({
      where: { isActive: true },
    });

    for (const task of activeTasks) {
      await prisma.weeklyTaskState.create({
        data: {
          weekId: week.id,
          taskConfigId: task.id,
          isActiveThisWeek: true,
        },
      });
    }

    // 重新查询完整数据
    week = await prisma.week.findUniqueOrThrow({
      where: { id: week.id },
      include: {
        weeklyTaskStates: {
          include: { taskConfig: true },
        },
      },
    });
  }

  return week;
}

/** 获取本周功课 */
export async function getWeekHomeworks(weekId: string) {
  return prisma.homework.findMany({
    where: { weekId },
    orderBy: [{ deadlineDate: "asc" }, { createdAt: "asc" }],
  });
}

/** 获取活动列表 */
export async function getActivities() {
  return prisma.activity.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
}

/** 获取本周容量相关数据 */
export async function getWeekCapacityData(weekId: string) {
  const dayPlans = await prisma.dayPlan.findMany({
    where: { weekId },
    include: { slots: true },
    orderBy: { date: "asc" },
  });

  const weeklyStates = await prisma.weeklyTaskState.findMany({
    where: { weekId },
    include: { taskConfig: true },
  });

  return { dayPlans, weeklyStates };
}
