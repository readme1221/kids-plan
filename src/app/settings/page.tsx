export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db/client";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const tasks = await prisma.taskConfig.findMany({
    orderBy: { createdAt: "asc" },
  });

  const activities = await prisma.activity.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    include: { linkedTask: true },
  });

  return (
    <SettingsClient
      tasks={tasks.map((t) => ({
        id: t.id,
        name: t.name,
        taskType: t.taskType,
        weeklySlotBudget: t.weeklySlotBudget,
        requiredSlots: t.requiredSlots,
        fixedWeekdays: t.fixedWeekdays,
        fixedPeriod: t.fixedPeriod,
        isActive: t.isActive,
      }))}
      activities={activities.map((a) => ({
        id: a.id,
        name: a.name,
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
        affectedPeriod: a.affectedPeriod,
        linkedTaskId: a.linkedTaskId,
        linkedTaskName: a.linkedTask?.name ?? null,
        activeThisWeek: a.activeThisWeek,
        autoLinkStop: a.autoLinkStop,
      }))}
    />
  );
}
