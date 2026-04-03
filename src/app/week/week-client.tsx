"use client";

import { useState } from "react";
import { TaskCard } from "@/components/week/task-card";
import { CapacityGauge } from "@/components/week/capacity-gauge";
import { WeekDayToggle } from "@/components/week/week-day-toggle";
import { SettleDialog } from "@/components/week/settle-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toggleWeekday, settleWeek } from "@/server/actions/week-actions";
import { updateProgressStage } from "@/server/actions/task-actions";
import { getDayName } from "@/lib/time";
import { toast } from "sonner";
import type { TaskType, ProgressStage } from "@/generated/prisma/client";

type Props = {
  weekId: string;
  weekStatus: string;
  dateStates: {
    date: string;
    dayOfWeek: number;
    isOpen: boolean;
    isToday: boolean;
  }[];
  taskStates: {
    id: string;
    taskConfigId: string;
    name: string;
    taskType: TaskType;
    weeklySlotBudget: number | null;
    requiredSlots: number | null;
    doneCount: number;
    assignedCount: number;
    progressStage: ProgressStage;
    carriedOverSlots: number;
    isActiveThisWeek: boolean;
  }[];
  capacity: {
    remainingCapacity: number;
    remainingDemand: number;
    status: "normal" | "tight" | "overloaded";
  };
  activityStates: {
    id: string;
    name: string;
    dayOfWeek: number;
    activeThisWeek: boolean;
  }[];
  homeworkCount: { total: number; done: number; pending: number };
};

export function WeekPageClient({
  weekId,
  weekStatus,
  dateStates,
  taskStates,
  capacity,
  activityStates,
  homeworkCount,
}: Props) {
  const [showSettleDialog, setShowSettleDialog] = useState(false);

  const handleToggleDay = async (date: Date, isOpen: boolean) => {
    await toggleWeekday({ weekId, date, isOpen });
  };

  const handleProgressChange = async (
    taskConfigId: string,
    stage: ProgressStage,
  ) => {
    await updateProgressStage({ weekId, taskConfigId, progressStage: stage });
    toast.success("进度已更新");
  };

  const handleSettle = async () => {
    try {
      await settleWeek(weekId);
      setShowSettleDialog(false);
      toast.success("周结算完成");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const dates = dateStates.map((d) => ({
    ...d,
    date: new Date(d.date),
  }));

  // 分组：配额型、截止型、固定时点
  const quotaTasks = taskStates.filter((t) => t.taskType === "quota_weekly");
  const deadlineTasks = taskStates.filter(
    (t) => t.taskType === "deadline_weekly" || t.taskType === "deadline_daily",
  );
  const fixedTasks = taskStates.filter((t) => t.taskType === "fixed_time");

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">本周计划</h1>
        {weekStatus === "active" && (
          <Button variant="outline" size="sm" onClick={() => setShowSettleDialog(true)}>
            周结算
          </Button>
        )}
      </div>

      {/* Capacity */}
      <CapacityGauge {...capacity} />

      {/* Week day toggle */}
      <WeekDayToggle dates={dates} onToggle={handleToggleDay} />

      {/* Activities */}
      {activityStates.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-[#CBD5E1]/60 mb-2">课外活动</h2>
          <div className="flex flex-wrap gap-2">
            {activityStates.map((a) => (
              <Badge
                key={a.id}
                variant={a.activeThisWeek ? "default" : "secondary"}
              >
                {a.name} ({getDayName(a.dayOfWeek)})
                {!a.activeThisWeek && " - 停课"}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Deadline tasks */}
      {deadlineTasks.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-[#CBD5E1]/60 mb-2">截止型任务</h2>
          <div className="space-y-2">
            {deadlineTasks.map((t) => (
              <TaskCard
                key={t.id}
                name={t.name}
                taskType={t.taskType}
                doneCount={t.doneCount}
                budget={t.weeklySlotBudget}
                requiredSlots={t.requiredSlots}
                progressStage={t.progressStage}
                carriedOverSlots={t.carriedOverSlots}
                isActiveThisWeek={t.isActiveThisWeek}
                onProgressChange={(stage) =>
                  handleProgressChange(t.taskConfigId, stage)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Quota tasks */}
      {quotaTasks.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-[#CBD5E1]/60 mb-2">配额型任务</h2>
          <div className="space-y-2">
            {quotaTasks.map((t) => (
              <TaskCard
                key={t.id}
                name={t.name}
                taskType={t.taskType}
                doneCount={t.doneCount}
                budget={t.weeklySlotBudget}
                requiredSlots={t.requiredSlots}
                progressStage={t.progressStage}
                carriedOverSlots={t.carriedOverSlots}
                isActiveThisWeek={t.isActiveThisWeek}
                onProgressChange={(stage) =>
                  handleProgressChange(t.taskConfigId, stage)
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Fixed time tasks */}
      {fixedTasks.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-[#CBD5E1]/60 mb-2">固定时点</h2>
          <div className="space-y-2">
            {fixedTasks.map((t) => (
              <TaskCard
                key={t.id}
                name={t.name}
                taskType={t.taskType}
                doneCount={t.doneCount}
                budget={t.weeklySlotBudget}
                requiredSlots={t.requiredSlots}
                progressStage={t.progressStage}
                carriedOverSlots={t.carriedOverSlots}
                isActiveThisWeek={t.isActiveThisWeek}
              />
            ))}
          </div>
        </div>
      )}

      {/* Settle dialog */}
      <SettleDialog
        open={showSettleDialog}
        onClose={() => setShowSettleDialog(false)}
        onConfirm={handleSettle}
        taskStates={taskStates.map((t) => ({
          taskConfigId: t.taskConfigId,
          name: t.name,
          taskType: t.taskType,
          weeklySlotBudget: t.weeklySlotBudget,
          requiredSlots: t.requiredSlots,
          doneCount: t.doneCount,
          progressStage: t.progressStage,
          carriedOverSlots: t.carriedOverSlots,
        }))}
        homeworkCount={homeworkCount}
      />
    </div>
  );
}
