import { prisma } from "@/lib/db/client";

/** 获取某天的 DayPlan，含 slots */
export async function getDayPlan(weekId: string, date: Date) {
  return prisma.dayPlan.findUnique({
    where: {
      weekId_date: { weekId, date },
    },
    include: {
      slots: {
        include: {
          taskConfig: true,
          homework: true,
        },
        orderBy: [{ period: "asc" }, { order: "asc" }],
      },
    },
  });
}

/** 获取某天的执行日志 */
export async function getDayExecutionLogs(weekId: string, date: Date) {
  return prisma.executionLog.findMany({
    where: { weekId, date },
    include: {
      taskConfig: true,
      homework: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

/** 检查连续滑移（规则 8.10）：连续 2 天非功课任务完成数为 0 */
export async function checkConsecutiveSlides(weekId: string, date: Date): Promise<boolean> {
  const yesterday = new Date(date);
  yesterday.setUTCDate(date.getUTCDate() - 1);

  const [todayLogs, yesterdayLogs] = await Promise.all([
    prisma.executionLog.findMany({
      where: {
        weekId,
        date,
        taskConfigId: { not: null }, // 非功课
        result: "done",
      },
    }),
    prisma.executionLog.findMany({
      where: {
        weekId,
        date: yesterday,
        taskConfigId: { not: null },
        result: "done",
      },
    }),
  ]);

  return todayLogs.length === 0 && yesterdayLogs.length === 0;
}
